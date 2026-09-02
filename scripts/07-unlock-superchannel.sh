#!/bin/bash
# Abort the build on any failure. Without this, a failing PATCH would
# print its error, the trailing echo would return 0, and 06-compile.sh
# would treat the whole script as successful - the exact way the 5 GHz
# channel patch shipped as a silent no-op.
set -e
echo "============================================"
echo "=== SUPERCHANNEL UNLOCK - SAFE SPECTRUM ==="
echo "============================================"

#############################################
# PATCH 1: ath/regd.c (Kernel Regulatory)
# We expand frequencies ONLY to what board-2.bin EEPROM supports!
# 2GHz: 2182-2484 MHz
# 5GHz: 5115-5930 MHz
#############################################
for REGD in $(find . -path "*/drivers/net/wireless/ath/regd.c" 2>/dev/null); do
  echo "[PATCH 1] Patching: $REGD"
  sed -i 's/REG_RULE(2412-10, 2462+10, 40, 0, 20, 0)/REG_RULE(2182-10, 2484+10, 40, 0, 33, 0)/g' "$REGD"
  sed -i 's/REG_RULE(2467-10, 2472+10, 40, 0, 20,/REG_RULE(2182-10, 2484+10, 40, 0, 33,/g' "$REGD"
  sed -i 's/REG_RULE(2484-10, 2484+10, 40, 0, 20,/REG_RULE(2484-10, 2484+10, 40, 0, 33,/g' "$REGD"
  
  sed -i 's/REG_RULE(5150-10, 5350+10, 80, 0, 30,/REG_RULE(5115-10, 5930+10, 160, 0, 33,/g' "$REGD"
  sed -i 's/REG_RULE(5470-10, 5850+10, 80, 0, 30,/REG_RULE(5115-10, 5930+10, 160, 0, 33,/g' "$REGD"
  sed -i 's/REG_RULE(5725-10, 5850+10, 80, 0, 30,/REG_RULE(5115-10, 5930+10, 160, 0, 33,/g' "$REGD"
  
  sed -i 's/NL80211_RRF_NO_IR/0/g' "$REGD"
  sed -i 's/NL80211_RRF_NO_OFDM/0/g' "$REGD"
  echo "  -> ath/regd.c patched OK"
done

for REG in $(find . -path "*/net/wireless/reg.c" 2>/dev/null); do
  echo "[PATCH 2] Patching: $REG"
  sed -i 's/REG_RULE(2412-10, 2462+10, 40, 6, 20, 0)/REG_RULE(2182-10, 2484+10, 40, 6, 33, 0)/g' "$REG"
  sed -i 's/REG_RULE(2467-10, 2472+10, 20, 6, 20,/REG_RULE(2182-10, 2484+10, 40, 6, 33,/g' "$REG"
  sed -i 's/REG_RULE(2484-10, 2484+10, 20, 6, 20,/REG_RULE(2484-10, 2484+10, 40, 6, 33,/g' "$REG"
  
  sed -i '/if (!is_valid_rd(rd)) {/{N;N;N;N;d}' "$REG"
  sed -i '/if (WARN(!is_valid_rd(rd)/{N;N;N;d}' "$REG"
  
  sed -i 's/NL80211_RRF_NO_IR | NL80211_RRF_AUTO_BW/0/g' "$REG"
  sed -i 's/NL80211_RRF_NO_IR/0/g' "$REG"
  sed -i 's/NL80211_RRF_NO_OFDM/0/g' "$REG"
  echo "  -> net/wireless/reg.c patched OK"
done

for UTIL in $(find . -path "*/net/wireless/util.c" 2>/dev/null); do
  echo "[PATCH 3] Patching: $UTIL"
  sed -i '/case NL80211_BAND_2GHZ:/a\t\tchan = (int)(char)chan;' "$UTIL"
  echo "  -> net/wireless/util.c patched OK"
done

#############################################
# PATCH 4, 5 and 5B have MOVED.
#
# They used to edit hostapd's hw_features.c and ath10k-ct's mac.c/core.h in
# place, here, under build_dir. That silently does nothing for those two
# packages: both declare build VARIANTs, and include/package.mk gives every
# variant its own PKG_BUILD_DIR. `make package/.../prepare` unpacks one of
# them, the edit lands there, and the full build then unpacks the variant we
# actually ship (kmod-ath10k-ct-smallbuffers, wpad-openssl) into a separate
# pristine directory and compiles that. The shipped driver kept its stock
# 27-channel 5 GHz table while LuCI advertised 68, so selecting one of the
# extra channels left hostapd without a frequency and the radio went silent.
#
# They are now generated as real OpenWrt patches by
#   scripts/gen_package_patches.py  (invoked by scripts/10-gen-package-patches.sh)
# and dropped into the packages' own patches/ directories, where OpenWrt
# applies them during Build/Prepare - for every variant, every unpack.
#
# PATCHES 1-3 above stay here: they target mac80211/backports, which has no
# VARIANT, hence a single build directory that in-place editing does reach.
#############################################

echo "PATCHES 1-3 applied (mac80211/backports)."
echo "PATCHES 4/5/5B are handled by 10-gen-package-patches.sh as real"
echo "OpenWrt package patches - see the note above for why."
