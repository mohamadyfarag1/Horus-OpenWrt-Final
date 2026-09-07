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
# 2GHz: 2182-2750 MHz (Full 2.3 GHz - 2.732 GHz SuperChannel)
# 5GHz: 5115-5930 MHz
#############################################
for REGD in $(find . -path "*/drivers/net/wireless/ath/regd.c" 2>/dev/null); do
  echo "[PATCH 1] Patching: $REGD"
  sed -i 's/REG_RULE(2412-10, 2462+10, 40, 0, 20, 0)/REG_RULE(2182-10, 2750+10, 40, 0, 33, 0)/g' "$REGD"
  sed -i 's/REG_RULE(2467-10, 2472+10, 40, 0, 20,/REG_RULE(2182-10, 2750+10, 40, 0, 33,/g' "$REGD"
  sed -i 's/REG_RULE(2484-10, 2484+10, 40, 0, 20,/REG_RULE(2182-10, 2750+10, 40, 0, 33,/g' "$REGD"
  
  sed -i 's/REG_RULE(5150-10, 5350+10, 80, 0, 30,/REG_RULE(5115-10, 5980+10, 160, 0, 33,/g' "$REGD"
  sed -i 's/REG_RULE(5470-10, 5850+10, 80, 0, 30,/REG_RULE(5115-10, 5980+10, 160, 0, 33,/g' "$REGD"
  sed -i 's/REG_RULE(5725-10, 5850+10, 80, 0, 30,/REG_RULE(5115-10, 5980+10, 160, 0, 33,/g' "$REGD"
  
  sed -i 's/NL80211_RRF_NO_IR/0/g' "$REGD"
  sed -i 's/NL80211_RRF_NO_OFDM/0/g' "$REGD"
  echo "  -> ath/regd.c patched OK"
done

for REG in $(find . -path "*/net/wireless/reg.c" 2>/dev/null); do
  echo "[PATCH 2] Patching: $REG"
  sed -i 's/REG_RULE(2412-10, 2462+10, 40, 6, 20, 0)/REG_RULE(2182-10, 2750+10, 40, 6, 33, 0)/g' "$REG"
  sed -i 's/REG_RULE(2467-10, 2472+10, 20, 6, 20,/REG_RULE(2182-10, 2750+10, 40, 6, 33,/g' "$REG"
  sed -i 's/REG_RULE(2484-10, 2484+10, 20, 6, 20,/REG_RULE(2182-10, 2750+10, 40, 6, 33,/g' "$REG"
  
  # Bypass regulatory checks safely without corrupting C syntax or deleting curly braces
  sed -i 's/static bool is_valid_rd(const struct ieee80211_regdomain \*rd)/static bool is_valid_rd(const struct ieee80211_regdomain *rd) { return true; }\nstatic bool _orig_is_valid_rd(const struct ieee80211_regdomain *rd)/g' "$REG"
  sed -i 's/if (!is_valid_rd(rd))/if (0 \&\& !is_valid_rd(rd))/g' "$REG"
  sed -i 's/if (WARN(!is_valid_rd(rd)/if (0 \&\& WARN(!is_valid_rd(rd)/g' "$REG"
  
  sed -i 's/NL80211_RRF_NO_IR | NL80211_RRF_AUTO_BW/0/g' "$REG"
  sed -i 's/NL80211_RRF_NO_IR/0/g' "$REG"
  sed -i 's/NL80211_RRF_NO_OFDM/0/g' "$REG"
  echo "  -> net/wireless/reg.c patched OK"
done

########################################
# PATCH 2B: ignore the peer AP's Country IE (client / client+WDS)
#
# In station mode cfg80211 feeds every beacon's Country IE to
# regulatory_hint_country_ie(), which REPLACES our unlocked regdomain
# with whatever the peer advertises. Every SuperChannel frequency that
# falls outside the peer's domain is then flagged IEEE80211_CHAN_DISABLED,
# mac80211 clamps bss_conf.txpower to that channel's (now zero) regulatory
# power and the link dies. That is the "the moment I switch the AP to
# client or client+WDS the power drops to 0" report - it is not a driver
# or calibration problem, the regdomain is being overwritten from the air.
#
# `option country_ie '0'` in /etc/config/wireless does NOT prevent this.
# That option is hostapd's ieee80211d, i.e. it only stops US from putting
# a Country IE in OUR beacons; it has no effect on the receive path. The
# receive path has to be disarmed here, in the kernel.
#
# Done as a function-entry `return` rather than by setting
# REGULATORY_COUNTRY_IE_IGNORE on the wiphy, because ath/regd.c calls
# wiphy_apply_custom_regulatory() with REGULATORY_STRICT_REG and would
# re-arm the hint path on every reg notifier run.
#############################################
for REG in $(find . -path "*/net/wireless/reg.c" 2>/dev/null); do
  echo "[PATCH 2B] Disarming country-IE hints in: $REG"
  python3 - "$REG" <<'PYEOF'
import re
import sys

path = sys.argv[1]
with open(path, encoding="utf-8", errors="ignore") as fh:
    src = fh.read()

MARK = "Horus: country IE ignored"
if MARK in src:
    print("  -> already patched, skipping")
    sys.exit(0)

# void regulatory_hint_country_ie(struct wiphy *wiphy, enum nl80211_band band,
#                                 const u8 *country_ie, u8 country_ie_len)
# {
m = re.search(
    r"^void\s+regulatory_hint_country_ie\s*\(.*?\)\s*\n?\{",
    src, re.M | re.S)
if not m:
    # Not fatal on its own only if the symbol is genuinely absent; if the
    # symbol exists but the signature drifted we MUST stop, otherwise the
    # build silently ships the STA power-collapse bug again.
    if "regulatory_hint_country_ie" in src:
        print("!!!! regulatory_hint_country_ie() found but its definition did "
              "not match - refusing to ship an unpatched reg.c")
        sys.exit(1)
    print("!!!! regulatory_hint_country_ie() not present in %s" % path)
    sys.exit(1)

ins = (m.group(0) +
       "\n\treturn; /* " + MARK + ": a peer AP must never shrink our regdomain */")
src = src[:m.start()] + ins + src[m.end():]

with open(path, "w", encoding="utf-8", newline="\n") as fh:
    fh.write(src)
print("  -> regulatory_hint_country_ie() now returns immediately")
PYEOF
  echo "  -> net/wireless/reg.c country-IE path disarmed OK"
done
#############################################
# PATCH 2C: ignore the peer AP's 802.11h Power Constraint (client mode)
#
# The second producer of "0 dBm in client mode". Even with the country-IE
# path disarmed, mac80211 still honours the Power Constraint IE and the
# VHT Transmit Power Envelope that the peer AP beacons:
# ieee80211_handle_pwr_constr() turns them into link->ap_power_level, and
# ieee80211_recalc_txpower() then takes the MINIMUM of that and our own
# configured txpower. A Ubiquiti AP that advertises a low local maximum
# therefore pulls our TX down no matter what `option txpower '30'` says.
#
# Non-fatal: the function is static and has been renamed/reshaped across
# kernel versions. If it is not found the build continues - PATCH 2B is
# the one that must not silently fail.
#############################################
for MLME in $(find . -path "*/net/mac80211/mlme.c" 2>/dev/null); do
  echo "[PATCH 2C] Disarming power-constraint handling in: $MLME"
  python3 - "$MLME" <<'PYEOF'
import re
import sys

path = sys.argv[1]
with open(path, encoding="utf-8", errors="ignore") as fh:
    src = fh.read()

MARK = "Horus: peer power constraint ignored"
if MARK in src:
    print("  -> already patched, skipping")
    sys.exit(0)

m = re.search(r"^static\s+u\d+\s+ieee80211_handle_pwr_constr\s*\(.*?\)\s*\n?\{",
              src, re.M | re.S)
if not m:
    print("  -> ieee80211_handle_pwr_constr() not found, skipping (non-fatal)")
    sys.exit(0)

ins = (m.group(0) +
       "\n\treturn 0; /* " + MARK + ": txpower is ours to decide */")
src = src[:m.start()] + ins + src[m.end():]

with open(path, "w", encoding="utf-8", newline="\n") as fh:
    fh.write(src)
print("  -> ieee80211_handle_pwr_constr() now returns 0")
PYEOF
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
# PATCHES 1-3 above (including 2B/2C) stay here: they target mac80211/backports, which has no
# VARIANT, hence a single build directory that in-place editing does reach.
#############################################

echo "PATCHES 1, 2, 2B, 2C and 3 applied (mac80211/backports)."
echo "PATCHES 4/5/5B are handled by 10-gen-package-patches.sh as real"
echo "OpenWrt package patches - see the note above for why."
