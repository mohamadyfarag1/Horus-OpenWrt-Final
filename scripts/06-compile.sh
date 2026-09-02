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

# ---------------------------------------------------------------------
# CRITICAL ORDERING - this is what broke the last build.
#
# The Wi-Fi driver this device loads is kmod-ath10k-ct, a SEPARATE package
# from mac80211, with its own source tree in build_dir. It is a kernel
# module, so its `.prepared` stamp must be NEWER than the kernel's. The
# previous build prepared ath10k-ct BEFORE the second `make target/linux/
# prepare` above, so the kernel stamp ended up newer; the final `make` then
# judged ath10k-ct stale, re-extracted a clean copy, and wiped PATCH 5. The
# driver shipped with its stock 27-channel table while the LuCI dropdown
# still advertised 68 - so selecting any of the extra channels left hostapd
# with a frequency the driver did not have ("Could not determine operating
# frequency"), the interface failed to start, and the radio went silent -
# exactly the "power drops to zero" the user reported.
#
# Fix: extract ath10k-ct LAST, after every kernel prepare, then patch it,
# then compile it immediately so its result is locked in before the full
# build. Nothing after this point re-prepares the kernel.
# ---------------------------------------------------------------------
echo "======================================="
echo "Step 1.7: Extracting ath10k-ct AFTER the kernel (so the patch sticks)..."
echo "======================================="
make package/kernel/ath10k-ct/prepare V=s -j$(nproc) 2>&1 || true

# The ath10k-ct tarball unpacks to ath10k-ct-<date>/ with one mac.c per
# kernel version (ath10k-6.4/mac.c, ath10k-6.7/mac.c, ...). Find the one(s)
# that actually carry the 5 GHz channel array under an ath10k-ct path -
# that is what PATCH 5 rewrites and what gets compiled.
find_ct_mac() {
    grep -rl 'ath10k_5ghz_channels\[\]' build_dir --include=mac.c 2>/dev/null         | grep 'ath10k-ct' | head -n1
}
CTMAC=$(find_ct_mac)
if [ -z "$CTMAC" ]; then
    echo "!!!! ath10k-ct source (mac.c with the 5 GHz array) was not extracted."
    echo "     PATCH 5 would silently patch the wrong ath10k copy."
    exit 1
fi
echo "ath10k-ct mac.c: $CTMAC"

echo "======================================="
echo "Step 2: Applying Superchannel Patches..."
echo "======================================="
cd build_dir
bash ../../scripts/07-unlock-superchannel.sh
cd ..

# Confirm PATCH 5 actually landed in the tree that will be compiled.
CT5G=$(grep -c 'CHAN5G(' "$CTMAC" 2>/dev/null || true); CT5G=${CT5G:-0}
echo "ath10k-ct mac.c CHAN5G lines after patch: $CT5G (stock ~28, patched ~69)"
if [ "$CT5G" -lt 60 ]; then
    echo "!!!! PATCH 5 did not land in $CTMAC - aborting."
    exit 1
fi

# Lock the patch in: build ath10k-ct (and hostapd) NOW, from the patched
# source, so their stamps say 'built' and the full make below cannot
# re-extract them behind our back.
echo "======================================="
echo "Step 2.5: Compiling patched ath10k-ct + hostapd to lock changes in..."
echo "======================================="
make package/network/services/hostapd/compile V=s -j$(nproc) 2>&1 | tail -n 8 || true
make package/kernel/ath10k-ct/compile V=s -j$(nproc) 2>&1 | tail -n 8 || true

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

# The re-extraction guard: if the full make re-prepared ath10k-ct despite
# the above, the source would be back to the stock table. Verify it is
# still our 68-channel version - if not, fail rather than ship a driver
# whose channel list disagrees with the UI.
CTMAC=$(find_ct_mac); CT5G_AFTER=$(grep -c 'CHAN5G(' "$CTMAC" 2>/dev/null || true); CT5G_AFTER=${CT5G_AFTER:-0}
echo "ath10k-ct mac.c CHAN5G lines after full build: $CT5G_AFTER"
if [ "$CT5G_AFTER" -lt 60 ]; then
    echo "!!!! ath10k-ct was re-extracted during the full build - PATCH 5 lost."
    echo "     The driver would ship the stock channel table and every extra"
    echo "     5 GHz channel in the UI would kill the radio when selected."
    exit 1
fi
echo "OK: ath10k-ct kept its 68-channel table through the full build."

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
