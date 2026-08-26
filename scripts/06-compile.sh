#!/bin/bash
# =============================================
# Script 6: Compile Firmware
# =============================================
set -e

cd openwrt

echo "======================================="
echo "Step 1: Injecting Superchannel Patches..."
echo "======================================="

# The correct way to patch mac80211 backports in OpenWrt is to place the patch
# in the mac80211 package's patch directory so Quilt applies it automatically.
mkdir -p package/kernel/mac80211/patches/build/
cp ../patches/mac80211-superchannel.patch package/kernel/mac80211/patches/build/999-unlock-superchannel.patch

# Also patch hostapd so it allows advanced modes on extended channels
mkdir -p package/network/services/hostapd/patches/
cp ../patches/hostapd-superchannel.patch package/network/services/hostapd/patches/999-unlock-superchannel.patch

echo "======================================="
echo "Step 2: Preparing Kernel and Wireless Sources..."
echo "======================================="
make target/linux/prepare V=s -j$(nproc) 2>&1 || true

# Prepare wireless modules (this will now automatically apply our injected patches!)
make package/kernel/mac80211/prepare V=s -j$(nproc) 2>&1 || true
make package/network/services/hostapd/prepare V=s -j$(nproc) 2>&1 || true

echo "======================================="
echo "Step 3: Starting Full Compilation..."
echo "======================================="
# Always save the full compile log to build.log for debugging
make -j$(nproc) 2>&1 | tee build.log

# If the build failed, exit with error
if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "❌ Build failed! Check build.log for details."
    exit 1
fi

echo "✅ Firmware compilation complete!"
