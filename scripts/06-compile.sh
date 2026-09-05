#!/bin/bash
# =============================================
# Script 6: Compile Firmware
# =============================================
set -e

# Run regdb generation (runs outside openwrt folder then copies it in)
bash scripts/09-generate-regdb.sh

cd openwrt

echo "======================================="
echo "Step 1: Preparing kernel and wireless sources..."
echo "======================================="
make target/linux/prepare V=s -j$(nproc) 2>&1 || true
make package/kernel/mac80211/prepare V=s -j$(nproc) 2>&1 || true
make package/network/services/hostapd/prepare V=s -j$(nproc) 2>&1 || true

echo "======================================="
echo "Step 1.5: PSGMII verify + kernel re-prepare..."
echo "======================================="
bash ../scripts/08-patch-psgmii.sh
make target/linux/prepare V=s -j$(nproc)
bash ../scripts/08-patch-psgmii.sh

echo "======================================="
echo "Step 2: Applying mac80211/backports patches (PATCH 1-3)..."
echo "======================================="
cd build_dir
bash ../../scripts/07-unlock-superchannel.sh
cd ..

# ---------------------------------------------------------------------
# ath10k-ct and hostapd cannot be patched the way mac80211 is.
#
# Both declare build VARIANTs, and include/package.mk gives each variant
# its own PKG_BUILD_DIR. An in-place edit after `make .../prepare` lands in
# one variant's directory; the full build then unpacks the variant we ship
# (kmod-ath10k-ct-smallbuffers, wpad-openssl) into a separate pristine
# directory and compiles that. The last image shipped exactly that way: the
# driver kept its stock 27-channel 5 GHz table while LuCI offered 68, so
# selecting one of the extra channels left hostapd with a frequency the
# driver never registered ("Could not determine operating frequency"), the
# interface failed to start, and the radio went silent.
#
# Generate them as real OpenWrt patches instead and let OpenWrt apply them
# during Build/Prepare, for every variant, every unpack.
# ---------------------------------------------------------------------
echo "======================================="
echo "Step 2.5: Installing ath10k-ct + hostapd package patches..."
echo "======================================="
bash ../scripts/10-gen-package-patches.sh

# ---------------------------------------------------------------------
# The channel plan is written down TWICE: once as the driver table
# (CHANS in gen_package_patches.py, which becomes 999-horus-superchannels
# .patch) and once as the LuCI dropdown (horus_freqs in 05-configure.sh).
# They are independent lists, and only the driver one is real.
#
# A frequency in the UI but not in the driver is precisely the failure the
# user sees as "the power dropped to zero": LuCI happily offers it, hostapd
# asks for a frequency the phy never registered, gets "Could not determine
# operating frequency", the interface fails to start and the radio goes
# silent. Catch the drift here rather than on the device.
# ---------------------------------------------------------------------
echo "======================================="
echo "Step 2.6: LuCI dropdown vs driver channel table..."
echo "======================================="
WJS=feeds/luci/modules/luci-mod-network/htdocs/luci-static/resources/view/network/wireless.js
# The authoritative list is the one gen_package_patches.py actually wrote
# into the driver. It must NOT be recovered from the unified diff: the 27
# channels that were already in the stock table appear there as unchanged
# CONTEXT lines rather than '+' lines, so a '^+' grep counts only the 41
# additions and fails a perfectly good patch. (That is exactly what broke
# run #90.)
DRVFREQ=tmp/horus-driver-freqs.txt
if [ ! -s "$DRVFREQ" ]; then
    echo "!!!! $DRVFREQ missing - gen_package_patches.py did not write it."
    exit 1
fi
sort -u "$DRVFREQ" > /tmp/horus.driver.freqs
DRVN=$(wc -l < /tmp/horus.driver.freqs)
echo "driver table : $DRVN frequencies"
if [ "$DRVN" -lt 60 ]; then
    echo "!!!! the generated driver patch only carries $DRVN 5 GHz channels."
    exit 1
fi

if [ -f "$WJS" ] && grep -q 'horus_freqs' "$WJS"; then
    sed -n '/horus_freqs *= *\[/,/\];/p' "$WJS" \
      | grep -oE '\b5[0-9]{3}\b' | sort -u > /tmp/horus.ui.freqs
    echo "LuCI dropdown: $(wc -l < /tmp/horus.ui.freqs) frequencies"
    ONLY_UI=$(comm -13 /tmp/horus.driver.freqs /tmp/horus.ui.freqs || true)
    if [ -n "$ONLY_UI" ]; then
        echo "!!!! LuCI would offer frequencies the driver never registers:"
        echo "$ONLY_UI" | tr '\n' ' '; echo
        echo "     Selecting one of these is what makes the radio go silent."
        echo "     Keep horus_freqs (05-configure.sh) and CHANS"
        echo "     (gen_package_patches.py) identical."
        exit 1
    fi
    ONLY_DRV=$(comm -23 /tmp/horus.driver.freqs /tmp/horus.ui.freqs || true)
    if [ -n "$ONLY_DRV" ]; then
        echo "note: driver has extra channels the dropdown omits (harmless):"
        echo "$ONLY_DRV" | tr '\n' ' '; echo
    fi
    echo "OK: every frequency LuCI offers exists in the driver table."
else
    echo "note: no horus_freqs injection in wireless.js - LuCI will simply"
    echo "      enumerate the phy, which is the driver table. Consistent."
fi

echo "======================================="
echo "Step 3: Starting Full Compilation..."
echo "======================================="
# Always save the full compile log to build.log for debugging
make -j$(nproc) 2>&1 | tee build.log

# If the build failed, print the REAL error before exiting.
#
# A parallel `make` only prints "ERROR: <pkg> failed to build" and writes
# the compiler output to logs/<pkg>/*.txt. Without this, diagnosing a
# failure costs a whole CI round-trip - which is exactly what the
# ath10k-ct BUILD_BUG_ON failure cost.
if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "======================================="
    echo "BUILD FAILED - real compiler output follows"
    echo "======================================="
    FAILED=$(sed -n 's/^ *ERROR: \([^ ]*\) failed to build.*/\1/p' build.log | sort -u)
    if [ -n "$FAILED" ]; then
        for pkg in $FAILED; do
            echo "##### $pkg #####"
            find "logs/$pkg" -name '*.txt' 2>/dev/null | while read -r L; do
                echo "----- $L (last 80 lines) -----"
                tail -n 80 "$L"
            done
        done
    else
        echo "(no 'ERROR: <pkg> failed to build' line; tail of build.log:)"
        tail -n 60 build.log
    fi
    echo "======================================="
    exit 1
fi

# Verify the driver we actually ship carries the extended table. The
# smallbuffers variant is the one in the image, so check ITS build dir -
# checking "any ath10k-ct directory" is what let the previous bug through.
# The ath10k-ct tarball ships one full driver tree per upstream kernel
# (ath10k-6.2, -6.4, -6.10, ...) and only the CT_KVER one is compiled, so
# read the exact path our patch targets straight out of the patch header
# instead of grabbing whichever mac.c `find` happens to hit first. Then
# check it inside the SMALLBUFFERS variant - that is the driver in the
# image, and "any ath10k-ct directory will do" is precisely what let the
# previous bug through.
CTPATCH=package/kernel/ath10k-ct/patches/999-horus-superchannels.patch
CTSUB=$(grep -m1 '^--- a/' "$CTPATCH" | sed 's|^--- a/||; s|/mac\.c$||')
if [ -z "$CTSUB" ]; then
    echo "!!!! could not read the driver subdirectory out of $CTPATCH"
    exit 1
fi
echo "driver subdirectory the patch targets: $CTSUB"

CTMAC=$(find build_dir -path "*ath10k-ct-smallbuffers*/$CTSUB/mac.c" 2>/dev/null | head -n1)
if [ -z "$CTMAC" ]; then
    echo "!!!! $CTSUB/mac.c not found in the smallbuffers variant build dir."
    echo "     That is the driver that ships - cannot verify its channel table."
    find build_dir -type d -name 'ath10k-ct*' 2>/dev/null | head
    exit 1
fi
CT5G=$(grep -c 'CHAN5G(' "$CTMAC" 2>/dev/null || true); CT5G=${CT5G:-0}
echo "shipped driver source : $CTMAC"
echo "CHAN5G entries        : $CT5G  (stock 28, patched 162)"
if [ "$CT5G" -lt 150 ]; then
    echo "!!!! The SHIPPED ath10k-ct variant does NOT have the extended table."
    echo "     999-horus-superchannels.patch did not reach this variant, so the"
    echo "     driver would expose ~27 channels while LuCI offers 162 - picking"
    echo "     one of the extras then kills the radio. Refusing to ship."
    exit 1
fi
grep -E "define ATH10K_(NUM_CHANS|MAX_5G_CHAN)" "$(dirname "$CTMAC")/core.h" || true
grep -E "channels\[[0-9]+\]" "$(dirname "$CTMAC")/wmi.h" || true
if grep -q "channels\[64\]" "$(dirname "$CTMAC")/wmi.h" 2>/dev/null; then
    echo "!!!! wmi.h still has stock channels[64] - scans with >64 channels will fail with -22"
    exit 1
fi
echo "OK: shipped ath10k-ct carries the 162-channel table and extended scan buffer."

# ---------------------------------------------------------------------
# Post-build verification.
#
# A missing ath10k firmware blob does not fail the build - it fails on the
# device, at probe time, with "could not probe fw (-12)" and BOTH radios
# dead. That is exactly what shipped when DEVICE_PACKAGES named the
# non-existent package ath10k-firmware-qca4019-ct-fullall: the name was
# silently ignored and no firmware-N.bin ever entered the image. Assert the
# blobs are really in the rootfs so this can never ship unnoticed again.
# ---------------------------------------------------------------------
echo "======================================="
echo "Step 4: Verifying Wi-Fi firmware made it into the image..."
echo "======================================="
FWDIR=$(find build_dir -type d -path '*/root-*/lib/firmware/ath10k/QCA4019/hw1.0' | head -n1)
if [ -z "$FWDIR" ]; then
    echo "!!!! /lib/firmware/ath10k/QCA4019/hw1.0 is missing from the rootfs."
    exit 1
fi
echo "rootfs ath10k dir: $FWDIR"
ls -la "$FWDIR"

if ! ls "$FWDIR"/firmware-*.bin >/dev/null 2>&1; then
    echo ""
    echo "!!!! NO firmware-N.bin IN THE IMAGE."
    echo "     ath10k will fail at probe with -12 and both radios stay down."
    echo "     Check that DEVICE_PACKAGES (02-patch-makefiles.sh) and"
    echo "     config/horus.config both name ath10k-firmware-qca4019-ct."
    exit 1
fi
if [ ! -f "$FWDIR/board-2.bin" ]; then
    echo "!!!! board-2.bin missing - ath10k has no calibration data."
    exit 1
fi
echo "OK: ath10k firmware + calibration present."

# The two blobs are the ONLY binaries this device's Wi-Fi depends on, and
# both are already byte-identical to the reference AP that drives all 68
# channels at 30 dBm. Verified on 2026-09-02 by md5 on both units:
#
#   board-2.bin   2bdce2247cda36f0c3884d09b580999d  (calibration / TX power)
#   firmware-5.bin 5dfb3152796b275349f92684240d9ab4 (ath10k-firmware-qca4019-ct 2020.11.08)
#
# So no binary needs editing - and editing board-2.bin is what WOULD cause
# 0 dBm, because it carries the per-band power calibration. Assert instead,
# so a silent drift can never be mistaken for a channel-table problem.
GOLD_BOARD=2bdce2247cda36f0c3884d09b580999d
GOLD_FW=5dfb3152796b275349f92684240d9ab4

HAVE_BOARD=$(md5sum "$FWDIR/board-2.bin" | cut -d' ' -f1)
if [ "$HAVE_BOARD" != "$GOLD_BOARD" ]; then
    echo "!!!! board-2.bin is NOT the reference calibration."
    echo "     have: $HAVE_BOARD"
    echo "     want: $GOLD_BOARD"
    echo "     files_ap/lib/firmware/ath10k/QCA4019/hw1.0/board-2.bin should"
    echo "     overlay whatever ath10k-board-qca4019 installed. Wrong"
    echo "     calibration means wrong TX power - possibly 0 dBm."
    exit 1
fi
echo "OK: board-2.bin matches the reference AP calibration."

HAVE_FW=$(md5sum "$FWDIR"/firmware-*.bin | head -n1 | cut -d' ' -f1)
if [ "$HAVE_FW" != "$GOLD_FW" ]; then
    echo "WARNING: ath10k firmware differs from the reference AP."
    echo "         have: $HAVE_FW"
    echo "         want: $GOLD_FW (ath10k-firmware-qca4019-ct 2020.11.08)"
    echo "         Not fatal, but the 68-channel plan is only PROVEN on the"
    echo "         reference blob. If channels misbehave, suspect this first."
else
    echo "OK: ath10k firmware matches the reference AP blob."
fi

REGDB=$(find build_dir -type f -path '*/root-*/lib/firmware/regulatory.db' | head -n1)
if [ -z "$REGDB" ]; then
    echo "!!!! regulatory.db missing - the extended channels would be blocked."
    exit 1
fi
echo "OK: custom regulatory.db present ($(stat -c%s "$REGDB") bytes)"

# Verify and enforce custom 29_ports.js in rootfs
find build_dir -type f -path '*/root-*/www/luci-static/resources/view/status/include/29_ports.js' 2>/dev/null | while read -r pjs; do
    if ! grep -q 'port_control' "$pjs" 2>/dev/null; then
        echo "Updating rootfs $pjs with custom LAN & Wi-Fi port control..."
        cp -f ../files_ap/www/luci-static/resources/view/status/include/29_ports.js "$pjs"
    else
        echo "OK: $pjs has custom LAN & Wi-Fi port control."
    fi
done

# Ensure port_control, port_action, hamax CLI, and init script exist with executable permissions in all rootfs directories
find build_dir -maxdepth 2 -type d -name 'root-*' 2>/dev/null | while read -r rdir; do
    echo "Enforcing port control & hamax utilities in $rdir..."
    mkdir -p "$rdir/usr/bin" "$rdir/etc/init.d" "$rdir/www/cgi-bin" "$rdir/usr/lib/hamax"
    cp -f ../files_ap/usr/bin/port_control "$rdir/usr/bin/port_control"
    chmod 755 "$rdir/usr/bin/port_control"
    cp -f ../files_ap/usr/bin/hamax "$rdir/usr/bin/hamax"
    chmod 755 "$rdir/usr/bin/hamax"
    cp -rf ../files_ap/usr/lib/hamax/* "$rdir/usr/lib/hamax/" 2>/dev/null || true
    chmod 755 "$rdir/usr/lib/hamax/"* 2>/dev/null || true
    cp -f ../files_ap/etc/init.d/port_control "$rdir/etc/init.d/port_control"
    chmod 755 "$rdir/etc/init.d/port_control"
    cp -f ../files_ap/www/cgi-bin/port_action "$rdir/www/cgi-bin/port_action"
    chmod 755 "$rdir/www/cgi-bin/port_action"
done

echo "======================================="
echo "Step 5: Post-Build Self-Proving Output Verification..."
echo "======================================="
bash ../scripts/11-verify-artifact.sh

echo "Firmware compilation and verification complete!"
