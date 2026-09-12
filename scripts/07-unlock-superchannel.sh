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
  
  sed -i 's/REG_RULE(5150-10, 5350+10, 80, 0, 30,/REG_RULE(4900-10, 6100+10, 160, 0, 33,/g' "$REGD"
  sed -i 's/REG_RULE(5470-10, 5850+10, 80, 0, 30,/REG_RULE(4900-10, 6100+10, 160, 0, 33,/g' "$REGD"
  sed -i 's/REG_RULE(5725-10, 5850+10, 80, 0, 30,/REG_RULE(4900-10, 6100+10, 160, 0, 33,/g' "$REGD"
  
  sed -i 's/NL80211_RRF_NO_IR/0/g' "$REGD"
  sed -i 's/NL80211_RRF_NO_OFDM/0/g' "$REGD"
  echo "  -> ath/regd.c patched OK"
done

for REG in $(find . -path "*/net/wireless/reg.c" 2>/dev/null); do
  echo "[PATCH 2] Patching: $REG"
  sed -i 's/REG_RULE(2412-10, 2462+10, 40, 6, 20, 0)/REG_RULE(2182-10, 2750+10, 40, 6, 33, 0)/g' "$REG"
  sed -i 's/REG_RULE(2467-10, 2472+10, 20, 6, 20,/REG_RULE(2182-10, 2750+10, 40, 6, 33,/g' "$REG"
  sed -i 's/REG_RULE(2484-10, 2484+10, 20, 6, 20,/REG_RULE(2182-10, 2750+10, 40, 6, 33,/g' "$REG"

  sed -i 's/REG_RULE(5180-10, 5240+10, 80, 6, 20,/REG_RULE(4900-10, 6100+10, 160, 6, 33,/g' "$REG"
  sed -i 's/REG_RULE(5260-10, 5320+10, 80, 6, 20,/REG_RULE(4900-10, 6100+10, 160, 6, 33,/g' "$REG"
  sed -i 's/REG_RULE(5500-10, 5720+10, 160, 6, 20,/REG_RULE(4900-10, 6100+10, 160, 6, 33,/g' "$REG"
  sed -i 's/REG_RULE(5745-10, 5825+10, 80, 6, 20,/REG_RULE(4900-10, 6100+10, 160, 6, 33,/g' "$REG"
  
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

#############################################
# PATCH 3: cfg80211 frequency <-> channel-number mapping
#
# This is the one that made every extended 2.4 GHz channel useless.
#
# ieee80211_freq_khz_to_channel() only knows 2.4 GHz up to 2484 MHz. Anything
# above that falls through to the 5 GHz arm and comes back as
# (freq - 5000) / 5, i.e. a large negative number: 2487 MHz registered as
# channel -502, 2512 MHz as -497, 2732 MHz as -453. Below 2412 MHz the 2.4 GHz
# arm itself goes negative: 2312 MHz became -19. The old one-line workaround
# here (`chan = (int)(char)chan`) truncated those to a signed char, which only
# produced a different set of wrong numbers and silently dropped 2407 MHz
# (channel 256 -> 0).
#
# Meanwhile hostapd was patched (gen_package_patches.py) with the CORRECT
# mapping. So cfg80211 registered channel -19 for 2312 MHz while hostapd asked
# for channel 201, they never agreed, and the radio could beacon but no client
# could ever associate. Both sides are now generated from the same table.
#
# The reverse direction matters just as much: ieee80211_channel_to_freq_khz()
# maps 5 GHz channels 182..196 to the 4.9 GHz public-safety band
# (4000 + chan * 5). Our plan uses those numbers for 5910..5980 MHz, so that
# branch has to go or the top of the 5 GHz SuperChannel range lands 1 GHz low.
#############################################
HORUS_SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
for UTIL in $(find . -path "*/net/wireless/util.c" 2>/dev/null); do
  echo "[PATCH 3] Patching freq<->channel mapping in: $UTIL"
  HORUS_SCRIPT_DIR="$HORUS_SCRIPT_DIR" python3 - "$UTIL" <<'PYEOF'
import os
import re
import sys

sys.path.insert(0, os.environ["HORUS_SCRIPT_DIR"])
from gen_package_patches import (CHANS_2G, CHANS_5G, MAX_5G,
                                 c_chan_to_freq_2g, c_freq_to_chan_2g,
                                 c_chan_to_freq_5g, c_freq_to_chan_5g)

path = sys.argv[1]
with open(path, encoding="utf-8", errors="ignore") as fh:
    src = fh.read()

MARK = "Horus: SuperChannel frequency map"
if MARK in src:
    print("  -> already patched, skipping")
    sys.exit(0)

max_5g_freq = 5000 + 5 * MAX_5G
lo = min(f for _, f in CHANS_2G)
hi = max(f for _, f in CHANS_2G)
lo_5g = min(f for _, f in CHANS_5G)
hi_5g = max(f for _, f in CHANS_5G)

# --- forward: frequency -> channel number ---------------------------------
anchor = re.search(r"\n(\t*)if \(freq == 2484\)\n\t+return 14;\n", src)
if not anchor:
    print("!!!! ieee80211_freq_khz_to_channel(): 'if (freq == 2484) return 14;'"
          " anchor not found - refusing to ship an unmapped util.c")
    sys.exit(1)
ind = anchor.group(1)
block = ("\n%s/* %s: 2.4 GHz (%d - %d MHz) and 5 GHz (%d - %d MHz, %d channels).\n"
         "%s * Generated from _BLOCKS_2G and _BLOCKS_5G in scripts/gen_package_patches.py.\n"
         "%s * hostapd is generated from the same tables, and the two MUST agree. */\n"
         % (ind, MARK, lo, hi, lo_5g, hi_5g, len(CHANS_5G), ind, ind)
         + c_freq_to_chan_2g(ind, "freq", assign="return %s;", ok="", bad="return 0;")
         + c_freq_to_chan_5g(ind, "freq", assign="return %s;", ok="", bad="return 0;"))
block = "\n".join(l for l in block.split("\n") if l.strip() != "") + "\n"
src = src[:anchor.start()] + "\n" + block + anchor.group(0).lstrip("\n") + src[anchor.end():]

# 5 GHz ceiling: upstream stops the 5 GHz arm at 5945 MHz and hands anything
# above to the 6 GHz formula. This radio has no 6 GHz band, and our plan
# reaches %d MHz, so extend the 5 GHz arm instead.
# The ceiling moved between kernel releases (5925 in 6.6, 5945 in later trees),
# so match whatever is there rather than pinning one number.
old5 = re.search(r"(\t*)else if \(freq < 59\d\d\)\n\t+return \(freq - 5000\) / 5;", src)
if not old5:
    print("!!!! 5 GHz arm 'else if (freq < 59xx)' not found in %s" % path)
    sys.exit(1)
i5 = old5.group(1)
src = src[:old5.start()] + (
    "%selse if (freq <= %d) /* %s: 5 GHz reaches %d MHz, no 6 GHz radio here */\n"
    "%s\treturn (freq - 5000) / 5;" % (i5, max_5g_freq, MARK, max_5g_freq, i5)
) + src[old5.end():]

# --- reverse: channel number -> frequency ---------------------------------
rev = re.search(r"(\t*)if \(chan == 14\)\n\t+return MHZ_TO_KHZ\(2484\);\n"
                r"\t*else if \(chan < 14\)\n\t+return MHZ_TO_KHZ\(2407 \+ chan \* 5\);\n",
                src)
if not rev:
    print("!!!! ieee80211_channel_to_freq_khz(): 2.4 GHz arm not found in %s" % path)
    sys.exit(1)
ri = rev.group(1)
rblock = ("%s/* %s: reverse map, same table as above. */\n" % (ri, MARK)
          + c_chan_to_freq_2g(ri, "chan", ret="return MHZ_TO_KHZ(%s);"))
src = src[:rev.start()] + rblock + src[rev.end():]

# 5 GHz reverse mapping: channels 184..200 (4920..5000 MHz), 16..183, 221..237, 201..220
r4 = re.search(r"(\t*)if \(chan >= 182 && chan <= 196\)\n"
               r"\t+return MHZ_TO_KHZ\(4000 \+ chan \* 5\);\n"
               r"\t*else\n"
               r"\t+return MHZ_TO_KHZ\(5000 \+ chan \* 5\);\n"
               r"\t*break;\n", src)
if r4:
    r4i = r4.group(1)
    rblock_5g = ("%s/* %s: 5 GHz reverse map, generated from _BLOCKS_5G. */\n" % (r4i, MARK)
                 + c_chan_to_freq_5g(r4i, "chan", ret="return MHZ_TO_KHZ(%s);")
                 + ("%sreturn 0;\n%sbreak;\n" % (r4i, r4i)))
    src = src[:r4.start()] + rblock_5g + src[r4.end():]
    print("  -> 5 GHz reverse map replaced with exact Horus 5G plan")
else:
    print("  -> 4.9 GHz alias branch not present, nothing to undo")

with open(path, "w", encoding="utf-8", newline="\n") as fh:
    fh.write(src)
print("  -> freq<->channel mapping now covers %d - %d MHz and %d - %d MHz"
      % (lo, hi, lo_5g, hi_5g))
PYEOF
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
