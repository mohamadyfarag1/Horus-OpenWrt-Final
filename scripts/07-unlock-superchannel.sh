#!/bin/bash
# ============================================
# Script 7: SUPERCHANNEL C-CODE UNLOCKER
# Brutally removes Kernel frequency restrictions
# ============================================
set -e
echo "============================================"
echo "=== SUPERCHANNEL UNLOCK - Full Spectrum ==="
echo "============================================"

# We are called from inside 'openwrt' folder by 06-compile.sh
cd build_dir

#############################################
# PATCH 1: ath/regd.c (Kernel Regulatory)
# Expands 2GHz to 2192-2732 MHz
# Expands 5GHz to 4900-6100 MHz
# Removes NO_IR and NO_OFDM restrictions
#############################################
for REGD in $(find . -path "*/drivers/net/wireless/ath/regd.c" 2>/dev/null); do
  echo "[PATCH 1] Patching: $REGD"
  sed -i 's/REG_RULE(2412-10, 2462+10, 40, 0, 20, 0)/REG_RULE(2192-10, 2732+10, 40, 0, 33, 0)/g' "$REGD"
  sed -i 's/REG_RULE(2467-10, 2472+10, 40, 0, 20,/REG_RULE(2192-10, 2732+10, 40, 0, 33,/g' "$REGD"
  sed -i 's/REG_RULE(2484-10, 2484+10, 40, 0, 20,/REG_RULE(2484-10, 2484+10, 40, 0, 33,/g' "$REGD"
  sed -i 's/REG_RULE(5150-10, 5350+10, 80, 0, 30,/REG_RULE(4900-10, 6100+10, 160, 0, 33,/g' "$REGD"
  sed -i 's/REG_RULE(5470-10, 5850+10, 80, 0, 30,/REG_RULE(4900-10, 6100+10, 160, 0, 33,/g' "$REGD"
  sed -i 's/REG_RULE(5725-10, 5850+10, 80, 0, 30,/REG_RULE(4900-10, 6100+10, 160, 0, 33,/g' "$REGD"
  sed -i 's/NL80211_RRF_NO_IR/0/g' "$REGD"
  sed -i 's/NL80211_RRF_NO_OFDM/0/g' "$REGD"
  echo "  -> ath/regd.c patched OK"
done

#############################################
# PATCH 2: net/wireless/reg.c
# Expands world regdomain 00
# Removes is_valid_rd() checks completely
#############################################
for REG in $(find . -path "*/net/wireless/reg.c" 2>/dev/null); do
  echo "[PATCH 2] Patching: $REG"
  sed -i 's/REG_RULE(2412-10, 2462+10, 40, 6, 20, 0)/REG_RULE(2192-10, 2732+10, 40, 6, 33, 0)/g' "$REG"
  sed -i 's/REG_RULE(2467-10, 2472+10, 20, 6, 20,/REG_RULE(2192-10, 2732+10, 40, 6, 33,/g' "$REG"
  sed -i 's/REG_RULE(2484-10, 2484+10, 20, 6, 20,/REG_RULE(2484-10, 2484+10, 40, 6, 33,/g' "$REG"
  sed -i '/if (!is_valid_rd(rd)) {/{N;N;N;N;d}' "$REG"
  sed -i '/if (WARN(!is_valid_rd(rd)/{N;N;N;d}' "$REG"
  sed -i 's/NL80211_RRF_NO_IR | NL80211_RRF_AUTO_BW/0/g' "$REG"
  sed -i 's/NL80211_RRF_NO_IR/0/g' "$REG"
  sed -i 's/NL80211_RRF_NO_OFDM/0/g' "$REG"
  echo "  -> net/wireless/reg.c patched OK"
done

#############################################
# PATCH 3: net/wireless/util.c
# CRITICAL for 2.3GHz support!
#############################################
for UTIL in $(find . -path "*/net/wireless/util.c" 2>/dev/null); do
  echo "[PATCH 3] Patching: $UTIL"
  sed -i '/case NL80211_BAND_2GHZ:/a\t\tchan = (int)(char)chan;' "$UTIL"
  echo "  -> net/wireless/util.c patched OK"
done

#############################################
# PATCH 4: hostapd - hw_features.c
# Allow OFDM/HT/VHT on channel 14
#############################################
for HWF in $(find . -path "*/hostapd*/src/ap/hw_features.c" -o -path "*/wpad*/src/ap/hw_features.c" 2>/dev/null); do
  echo "[PATCH 4] Patching: $HWF"
  sed -i 's/wpa_printf(MSG_INFO, "Disable OFDM\/HT\/VHT on channel 14");//g' "$HWF"
  sed -i 's/iface->conf->hw_mode = HOSTAPD_MODE_IEEE80211B;/iface->conf->hw_mode = HOSTAPD_MODE_IEEE80211G;/g' "$HWF"
  sed -i '/iface->conf->ieee80211n = 0;/d' "$HWF"
  sed -i '/iface->conf->ieee80211ac = 0;/d' "$HWF"
  echo "  -> hostapd/hw_features.c patched OK"
done

echo "============================================"
echo "=== SUPERCHANNEL UNLOCK COMPLETE ==="
echo "============================================"
