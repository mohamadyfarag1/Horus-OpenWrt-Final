#!/bin/bash
echo "============================================"
echo "=== SUPERCHANNEL UNLOCK - Full Spectrum ==="
echo "============================================"

#############################################
# PATCH 1: ath/regd.c (Kernel Regulatory)
# Based on forum post #3 by anarchy99
# Expands 2GHz to 2192-2732 MHz
# Expands 5GHz to 4900-6100 MHz
# Removes NO_IR and NO_OFDM restrictions
#############################################
for REGD in $(find . -path "*/drivers/net/wireless/ath/regd.c" 2>/dev/null); do
  echo "[PATCH 1] Patching: $REGD"
  # 2GHz CH01-11 rule: expand to full 2.3GHz band
  sed -i 's/REG_RULE(2412-10, 2462+10, 40, 0, 20, 0)/REG_RULE(2192-10, 2732+10, 40, 0, 33, 0)/g' "$REGD"
  # 2GHz CH12-13 rule: expand to full band
  sed -i 's/REG_RULE(2467-10, 2472+10, 40, 0, 20,/REG_RULE(2192-10, 2732+10, 40, 0, 33,/g' "$REGD"
  # 2GHz CH14 rule: increase power
  sed -i 's/REG_RULE(2484-10, 2484+10, 40, 0, 20,/REG_RULE(2484-10, 2484+10, 40, 0, 33,/g' "$REGD"
  # 5GHz first range: expand to full 5GHz
  sed -i 's/REG_RULE(5150-10, 5350+10, 80, 0, 30,/REG_RULE(4900-10, 6100+10, 160, 0, 33,/g' "$REGD"
  # 5GHz second range: expand to full 5GHz
  sed -i 's/REG_RULE(5470-10, 5850+10, 80, 0, 30,/REG_RULE(4900-10, 6100+10, 160, 0, 33,/g' "$REGD"
  # 5GHz third range: expand to full 5GHz
  sed -i 's/REG_RULE(5725-10, 5850+10, 80, 0, 30,/REG_RULE(4900-10, 6100+10, 160, 0, 33,/g' "$REGD"
  # Remove NO_IR (No Initiate Radiation) - allow active scan
  sed -i 's/NL80211_RRF_NO_IR/0/g' "$REGD"
  # Remove NO_OFDM restriction - allow OFDM on all channels
  sed -i 's/NL80211_RRF_NO_OFDM/0/g' "$REGD"
  echo "  -> ath/regd.c patched OK"
done

#############################################
# PATCH 2: net/wireless/reg.c
# Based on forum post #3
# Expands world regdomain 00
# Removes is_valid_rd() checks completely
#############################################
for REG in $(find . -path "*/net/wireless/reg.c" 2>/dev/null); do
  echo "[PATCH 2] Patching: $REG"
  # Expand world regdomain 00 - 2GHz
  sed -i 's/REG_RULE(2412-10, 2462+10, 40, 6, 20, 0)/REG_RULE(2192-10, 2732+10, 40, 6, 33, 0)/g' "$REG"
  # Remove CH12-13 separate rule (now covered by expanded range)
  sed -i 's/REG_RULE(2467-10, 2472+10, 20, 6, 20,/REG_RULE(2192-10, 2732+10, 40, 6, 33,/g' "$REG"
  # Expand CH14 power
  sed -i 's/REG_RULE(2484-10, 2484+10, 20, 6, 20,/REG_RULE(2484-10, 2484+10, 40, 6, 33,/g' "$REG"
  # Remove ALL is_valid_rd() validation blocks (3 locations in the forum patch)
  # Location 1: reg_set_rd_user
  sed -i '/if (!is_valid_rd(rd)) {/{N;N;N;N;d}' "$REG"
  # Location 2: WARN version
  sed -i '/if (WARN(!is_valid_rd(rd)/{N;N;N;d}' "$REG"
  # Remove NO_IR flags from world regdomain
  sed -i 's/NL80211_RRF_NO_IR | NL80211_RRF_AUTO_BW/0/g' "$REG"
  sed -i 's/NL80211_RRF_NO_IR/0/g' "$REG"
  sed -i 's/NL80211_RRF_NO_OFDM/0/g' "$REG"
  echo "  -> net/wireless/reg.c patched OK"
done

#############################################
# PATCH 3: net/wireless/util.c
# CRITICAL for 2.3GHz support!
# Adds support for channel numbers > 127
# Without this, extended channels won't work
#############################################
for UTIL in $(find . -path "*/net/wireless/util.c" 2>/dev/null); do
  echo "[PATCH 3] Patching: $UTIL"
  # Add signed char cast for extended channel numbers
  # This allows channels 213-255 (2.3GHz band) to work
  sed -i '/case NL80211_BAND_2GHZ:/a\t\tchan = (int)(char)chan;' "$UTIL"
  echo "  -> net/wireless/util.c patched OK"
done

#############################################
# PATCH 4: hostapd - hw_features.c
# Allow OFDM/HT/VHT on channel 14
# Without this, channel 14 is B-only
#############################################
for HWF in $(find . -path "*/hostapd*/src/ap/hw_features.c" -o -path "*/wpad*/src/ap/hw_features.c" 2>/dev/null); do
  echo "[PATCH 4] Patching: $HWF"
  # Remove the block that disables OFDM/HT/VHT on channel 14
  sed -i 's/wpa_printf(MSG_INFO, "Disable OFDM\/HT\/VHT on channel 14");//g' "$HWF"
  sed -i 's/iface->conf->hw_mode = HOSTAPD_MODE_IEEE80211B;/iface->conf->hw_mode = HOSTAPD_MODE_IEEE80211G;/g' "$HWF"
  sed -i '/iface->conf->ieee80211n = 0;/d' "$HWF"
  sed -i '/iface->conf->ieee80211ac = 0;/d' "$HWF"
  echo "  -> hostapd/hw_features.c patched OK"
done

echo "============================================"
echo "=== SUPERCHANNEL UNLOCK COMPLETE ==="
echo "============================================"
