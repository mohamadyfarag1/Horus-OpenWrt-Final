#!/bin/bash
# =============================================
# Script 6: Compile Firmware
# =============================================
set -e

cd openwrt

echo "======================================="
echo "Step 1: Preparing kernel and wireless sources..."
echo "======================================="
make target/linux/prepare V=s -j$(nproc) 2>&1 || true

# Patch qca8k DSA switch driver to skip 100-retry PSGMII calibration loop (fixes LAN ports freeze/delay on boot)
cat << 'EOF' > patch_qca8k.py
import os, re
for root, dirs, files in os.walk('build_dir'):
    for file in files:
        if file.startswith('qca8k') and file.endswith('.c'):
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()
            # Replace loop boundaries exactly
            content = re.sub(r'int\s+retries\s*=\s*100\s*;', 'int retries = 1;', content)
            content = re.sub(r'retries\s*<\s*100', 'retries < 1', content)
            with open(path, 'w') as f:
                f.write(content)
EOF
python3 patch_qca8k.py
rm patch_qca8k.py

# Prepare wireless modules - this extracts mac80211-backports and hostapd
# source code into build_dir/ where our sed patches can find them
make package/kernel/mac80211/prepare V=s -j$(nproc) 2>&1 || true
make package/network/services/hostapd/prepare V=s -j$(nproc) 2>&1 || true

echo "======================================="
echo "Step 2: Applying Superchannel C-code Unlock..."
echo "======================================="
# This script searches build_dir/ for the extracted source files
# and applies sed-based text replacements (works on any kernel version)
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
