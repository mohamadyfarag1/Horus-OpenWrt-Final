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

# The Wi-Fi driver this device actually loads is kmod-ath10k-ct, which is a
# SEPARATE package from mac80211. Preparing mac80211 only extracts the
# backports tarball - and that tarball also contains a copy of the mainline
# ath10k driver which is never compiled here. If ath10k-ct is not extracted
# before 07-unlock-superchannel.sh runs, PATCH 5 finds only that dead
# backports copy, patches it, reports success, and the driver that really
# loads keeps its stock 28-channel table - every extra frequency then shows
# up in the UI but transmits at 0 dBm. Extract the real driver first.
make package/kernel/ath10k-ct/prepare V=s -j$(nproc) 2>&1 || true

if ! find build_dir -maxdepth 5 -type d -name 'ath10k-ct-*' | grep -q .; then
    echo "!!!! ath10k-ct source was not extracted into build_dir."
    echo "     PATCH 5 would silently patch the wrong ath10k copy."
    exit 1
fi
echo "ath10k-ct source tree present:"
find build_dir -maxdepth 5 -type d -name 'ath10k-ct-*'

echo "======================================="
echo "Step 1.5: Preparing Kernel and Patching PSGMII loop..."
echo "======================================="
bash ../scripts/08-patch-psgmii.sh
make target/linux/prepare V=s -j$(nproc)
bash ../scripts/08-patch-psgmii.sh


echo "======================================="
echo "Step 2: Applying Superchannel Patches..."
echo "======================================="
cd build_dir
bash ../../scripts/07-unlock-superchannel.sh
cd ..

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
