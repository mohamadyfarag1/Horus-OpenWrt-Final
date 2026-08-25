#!/bin/bash
# =============================================
# Script 6: Compile Firmware with PSGMII Fix
# =============================================
set -e

cd openwrt

echo "======================================="
echo "Step 1: Preparing kernel and wireless sources..."
echo "======================================="
make target/linux/prepare V=s -j$(nproc) 2>&1 || true

# ============================================
# PSGMII Fix: Reduce QCA8K switch calibration
# retries from 100 to 1 to prevent 2-minute
# boot delay and dead LAN ports on IPQ4019
# ============================================
echo "======================================="
echo "Step 2: Applying PSGMII boot delay fix..."
echo "======================================="
PATCHED=0
for f in $(find build_dir/ -path "*/drivers/net/dsa/qca/qca8k*c" 2>/dev/null); do
    sed -i 's/retries < 100/retries < 1/g' "$f"
    sed -i 's/retries < 10 /retries < 1 /g' "$f"
    echo "Patched PSGMII boot delay loop in: $f"
    PATCHED=$((PATCHED + 1))
done
if [ "$PATCHED" -eq 0 ]; then
    echo "WARNING: No QCA8K driver files found to patch!"
fi

# Prepare wireless modules
make package/kernel/mac80211/prepare V=s -j$(nproc) 2>&1 || true
make package/network/services/hostapd/prepare V=s -j$(nproc) 2>&1 || true

echo "======================================="
echo "Step 2.5: Applying Superchannel C-code Unlock..."
echo "======================================="
bash ../scripts/07-unlock-superchannel.sh

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
