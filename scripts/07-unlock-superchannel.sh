#!/bin/bash
# ============================================
# Script 7: SUPERCHANNEL C-CODE UNLOCKER (Python Engine)
# Re-written for modern Kernel 6.6+ compatibility
# ============================================
set -e
echo "============================================"
echo "=== SUPERCHANNEL UNLOCK - Full Spectrum ==="
echo "============================================"

# We are called from inside 'openwrt' directory by 06-compile.sh
cd build_dir

cat << 'EOF' > patch_superchannel.py
import os
import re

print("Starting Python Patch Engine...")

found1 = 0
for root, dirs, files in os.walk('.'):
    if 'regd.c' in files and 'ath' in root:
        filepath = os.path.join(root, 'regd.c')
        with open(filepath, 'r') as f:
            content = f.read()
        
        # 2GHz
        content = re.sub(r'REG_RULE\(\s*2412\s*-\s*10\s*,\s*2462\s*\+\s*10\s*,\s*40\s*,\s*0\s*,\s*\d+\s*,\s*0\s*\)', 'REG_RULE(2192-10, 2732+10, 40, 0, 33, 0)', content)
        content = re.sub(r'REG_RULE\(\s*2467\s*-\s*10\s*,\s*2472\s*\+\s*10\s*,\s*40\s*,\s*0\s*,\s*\d+\s*,', 'REG_RULE(2192-10, 2732+10, 40, 0, 33,', content)
        content = re.sub(r'REG_RULE\(\s*2484\s*-\s*10\s*,\s*2484\s*\+\s*10\s*,\s*40\s*,\s*0\s*,\s*\d+\s*,', 'REG_RULE(2484-10, 2484+10, 40, 0, 33,', content)
        
        # 5GHz (Flexible regex for spaces and dBm values)
        content = re.sub(r'REG_RULE\(\s*5150\s*-\s*10\s*,\s*5350\s*\+\s*10\s*,\s*80\s*,\s*0\s*,\s*\d+\s*,', 'REG_RULE(4900-10, 5350+10, 80, 0, 33,', content)
        content = re.sub(r'REG_RULE\(\s*5470\s*-\s*10\s*,\s*5850\s*\+\s*10\s*,\s*80\s*,\s*0\s*,\s*\d+\s*,', 'REG_RULE(5350-10, 5725+10, 80, 0, 33,', content)
        content = re.sub(r'REG_RULE\(\s*5725\s*-\s*10\s*,\s*5850\s*\+\s*10\s*,\s*80\s*,\s*0\s*,\s*\d+\s*,', 'REG_RULE(5725-10, 6100+10, 80, 0, 33,', content)
        
        content = content.replace('NL80211_RRF_NO_IR', '0')
        content = content.replace('NL80211_RRF_NO_OFDM', '0')
        
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Patched: {filepath}")
        found1 += 1

found2 = 0
for root, dirs, files in os.walk('.'):
    if 'reg.c' in files and 'wireless' in root:
        filepath = os.path.join(root, 'reg.c')
        with open(filepath, 'r') as f:
            content = f.read()
        
        # World Domain
        content = re.sub(r'REG_RULE\(\s*2412\s*-\s*10\s*,\s*2462\s*\+\s*10\s*,\s*40\s*,\s*6\s*,\s*\d+\s*,\s*0\s*\)', 'REG_RULE(2192-10, 2732+10, 40, 6, 33, 0)', content)
        content = re.sub(r'REG_RULE\(\s*2467\s*-\s*10\s*,\s*2472\s*\+\s*10\s*,\s*20\s*,\s*6\s*,\s*\d+\s*,', 'REG_RULE(2192-10, 2732+10, 40, 6, 33,', content)
        content = re.sub(r'REG_RULE\(\s*2484\s*-\s*10\s*,\s*2484\s*\+\s*10\s*,\s*20\s*,\s*6\s*,\s*\d+\s*,', 'REG_RULE(2484-10, 2484+10, 40, 6, 33,', content)
        
        # is_valid_rd bypass
        content = re.sub(r'(static bool is_valid_rd\([^)]+\)\s*\{)', r'\1 return true;', content)
        
        # Remove restrictions
        content = content.replace('NL80211_RRF_NO_IR_ALL', '0')
        content = content.replace('NL80211_RRF_NO_IR', '0')
        content = content.replace('NL80211_RRF_NO_OFDM', '0')
        
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Patched: {filepath}")
        found2 += 1

found3 = 0
for root, dirs, files in os.walk('.'):
    if 'util.c' in files and 'wireless' in root:
        filepath = os.path.join(root, 'util.c')
        with open(filepath, 'r') as f:
            content = f.read()
            
        if 'chan = (int)(char)chan;' not in content:
            content = content.replace('case NL80211_BAND_2GHZ:', 'case NL80211_BAND_2GHZ:\n\t\tchan = (int)(char)chan;')
            with open(filepath, 'w') as f:
                f.write(content)
        print(f"Patched: {filepath}")
        found3 += 1

if found1 == 0 and found2 == 0:
    print("WARNING: No files patched by Python engine!")
EOF

python3 patch_superchannel.py
rm patch_superchannel.py

FOUND4=0
for HWF in $(find . -path "*/hostapd*/src/ap/hw_features.c" -o -path "*/wpad*/src/ap/hw_features.c" 2>/dev/null); do
  sed -i 's/wpa_printf(MSG_INFO, "Disable OFDM\/HT\/VHT on channel 14");//g' "$HWF"
  sed -i 's/iface->conf->hw_mode = HOSTAPD_MODE_IEEE80211B;/iface->conf->hw_mode = HOSTAPD_MODE_IEEE80211G;/g' "$HWF"
  sed -i '/iface->conf->ieee80211n = 0;/d' "$HWF"
  sed -i '/iface->conf->ieee80211ac = 0;/d' "$HWF"
  FOUND4=$((FOUND4 + 1))
done

echo "============================================"
echo "=== SUPERCHANNEL UNLOCK COMPLETE ==="
echo "============================================"
