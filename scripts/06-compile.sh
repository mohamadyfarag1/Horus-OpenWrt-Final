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
make target/linux/prepare V=s -j$(nproc)

# Patch qca8k DSA switch driver to skip 100-retry PSGMII calibration loop (fixes LAN ports freeze/delay on boot)
# This is kept from the new logic to avoid the LAN bug!
cat << 'PYEOF' > /tmp/patch_psgmii.py
import os, re

patched = False
for root, dirs, files in os.walk('build_dir'):
    for file in files:
        if file.endswith('.c'):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    data = f.read()
                if 'PSGMII work is unstable' in data:
                    print("Found PSGMII target in:", path)
                    # Replace 100 with 1
                    data = re.sub(r'retries\s*<\s*100', 'retries < 1', data)
                    data = re.sub(r'retries\s*<=\s*100', 'retries <= 1', data)
                    data = re.sub(r'retries\s*==\s*100', 'retries == 1', data)
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(data)
                    print("Patched perfectly!")
                    patched = True
            except:
                pass
if not patched:
    print("Warning: Could not find PSGMII file to patch!")
PYEOF
python3 /tmp/patch_psgmii.py

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
