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

echo "======================================="
echo "Step 3: Starting Full Compilation..."
echo "======================================="
# Always save the full compile log to build.log for debugging
make -j$(nproc) 2>&1 | tee build.log

# If the build failed, exit with error
if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "? Build failed! Check build.log for details."
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
echo "CHAN5G entries        : $CT5G  (stock 28, patched 69)"
if [ "$CT5G" -lt 60 ]; then
    echo "!!!! The SHIPPED ath10k-ct variant does NOT have the extended table."
    echo "     999-horus-superchannels.patch did not reach this variant, so the"
    echo "     driver would expose ~27 channels while LuCI offers 68 - picking"
    echo "     one of the extras then kills the radio. Refusing to ship."
    exit 1
fi
grep -E "define ATH10K_(NUM_CHANS|MAX_5G_CHAN)" "$(dirname "$CTMAC")/core.h" || true
echo "OK: shipped ath10k-ct carries the 68-channel table."

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
md5sum "$FWDIR"/*.bin

REGDB=$(find build_dir -type f -path '*/root-*/lib/firmware/regulatory.db' | head -n1)
if [ -z "$REGDB" ]; then
    echo "!!!! regulatory.db missing - the extended channels would be blocked."
    exit 1
fi
echo "OK: custom regulatory.db present ($(stat -c%s "$REGDB") bytes)"

echo "? Firmware compilation complete!"
