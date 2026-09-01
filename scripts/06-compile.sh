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

echo "? Firmware compilation complete!"
