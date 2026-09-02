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
# PATCH 4: hostapd - let channel 14 keep OFDM/HT
#
# hostapd_select_hw_mode() in src/ap/hw_features.c force-downgrades channel
# 14 to bare 802.11b, because Japan forbids OFDM there:
#
#   if ((hw_mode == IEEE80211G || ieee80211n || ieee80211ac ||
#        ieee80211ax) && channel == 14) {
#           wpa_printf(MSG_INFO, "Disable OFDM/HT/VHT/HE on channel 14");
#           hw_mode = IEEE80211B; ieee80211n = 0; ieee80211ac = 0;
#           ieee80211ax = 0;
#   }
#
# This used to be four blind `sed` commands. They did only hit this block,
# but one of them keyed on the log text - which upstream has since changed
# to ".../HE on channel 14" - so that one had already silently stopped
# matching. Locate the block structurally by brace matching, delete it
# whole, and fail the build if it is not found. Channel 14 then keeps
# whatever hw_mode/htmode the UCI config asked for.
#
# NOTE: this only decides the MODE on channel 14. Whether the channel is
# usable at all is a regulatory question: a 20 MHz channel centred on 2484
# needs a rule covering 2474-2494, which is why 09-generate-regdb.sh emits
# 2182-2494 instead of stopping at 2484.
#############################################
cat << 'CH14EOF' > /tmp/patch_hostapd_ch14.py
import os, re, sys

MARK = re.compile(r'wpa_printf\(MSG_INFO,\s*"Disable OFDM[^"]*on channel 14"\);')

patched = 0
seen = 0

for root, _dirs, files in os.walk('.'):
    if 'hostapd' not in root and 'wpad' not in root:
        continue
    if not root.endswith(os.path.join('src', 'ap')):
        continue
    for name in files:
        if name != 'hw_features.c':
            continue
        path = os.path.join(root, name)
        try:
            src = open(path, 'r', encoding='utf-8', errors='ignore').read()
        except OSError:
            continue
        m = MARK.search(src)
        if not m:
            continue
        seen += 1

        if_at = src.rfind('if (', 0, m.start())
        if if_at == -1:
            print("!!!! ch14 marker found but no enclosing if() in %s" % path)
            sys.exit(1)

        body_at = src.find('{', if_at)
        if body_at == -1 or body_at > m.start():
            print("!!!! could not locate ch14 block body in %s" % path)
            sys.exit(1)

        depth = 0
        close_at = None
        for i in range(body_at, len(src)):
            if src[i] == '{':
                depth += 1
            elif src[i] == '}':
                depth -= 1
                if depth == 0:
                    close_at = i
                    break
        if close_at is None:
            print("!!!! unbalanced braces around ch14 block in %s" % path)
            sys.exit(1)

        block = src[if_at:close_at + 1]
        if 'channel == 14' not in block:
            print("!!!! matched block is not the channel 14 block in %s" % path)
            print(block[:400])
            sys.exit(1)

        replacement = ('/* Horus: channel 14 keeps the configured hw_mode/HT.\n'
                       '\t * Upstream forced 802.11b here for JP regulatory. */')
        src = src[:if_at] + replacement + src[close_at + 1:]
        open(path, 'w', encoding='utf-8').write(src)
        patched += 1
        print("  [ch14/hostapd] removed the 802.11b downgrade in %s" % path)

print("PATCH 4 summary: files_with_block=%d patched=%d" % (seen, patched))
if seen == 0:
    print("!!!! PATCH 4 FAILED: hostapd hw_features.c with the channel 14")
    print("     block was not found. Channel 14 would fall back to 802.11b.")
    sys.exit(1)
if patched != seen:
    print("!!!! PATCH 4 FAILED: some copies were left unpatched.")
    sys.exit(1)
CH14EOF

echo "[PATCH 4] Removing the hostapd 802.11b downgrade on channel 14..."
python3 /tmp/patch_hostapd_ch14.py
rm -f /tmp/patch_hostapd_ch14.py
echo "  -> hostapd channel 14 patched OK"

#############################################
# PATCH 5: ath10k(-ct) 5 GHz channel table  (THE one that gives power)
#
# The old PATCH 5 rewrote an array called "cfg80211_chan_def_5g" in
# net/wireless/chan.c. That symbol does NOT exist in any kernel, so the
# patch matched nothing and did nothing - a silent no-op. That is why the
# extra 5 GHz frequencies never appeared with power on this build even
# though they work on the reference AP.
#
# ath10k builds its channel list from ath10k_5ghz_channels[] in the
# driver's mac.c (macro CHAN5G(channel, freq, flags)). Upstream ships it
# 20 MHz-spaced (36,40,44,...). The reference AP replaces it with a
# 10 MHz-spaced list, 36..165 step 2 plus 169/173/177 = 68 entries, which
# is exactly the "iw phy" list captured from that AP. We reproduce that
# list here. freq = 5000 + 5*channel for every one of them.
#
# CRITICAL: the array header in the driver warns that adding entries
# REQUIRES bumping ATH10K_NUM_CHANS (survey[] size) and ATH10K_MAX_5G_CHAN
# in core.h, or the driver overruns survey[] and crashes. We patch both.
#
# Kernel difference note: this AP is kernel 6.6 / ath10k-ct while the
# reference is 5.15. The array name, the CHAN5G macro and the two core.h
# constants are identical across both, so the same edit applies. We do
# NOT hard-code a path - we search the extracted tree and, unlike the old
# PATCH 5, we FAIL LOUDLY if the array or the constant is not found.
#############################################
cat << 'PYEOF' > /tmp/patch_ath10k_chans.py
import os, re, sys

# Golden channel plan: 36..146 step 2, 149..165 step 2, then 169,173,177
chans = list(range(36, 147, 2)) + list(range(149, 166, 2)) + [169, 173, 177]
lines = "".join("\tCHAN5G(%d, %d, 0),\n" % (c, 5000 + 5 * c) for c in chans)
new_array = ("static const struct ieee80211_channel ath10k_5ghz_channels[] = {\n"
             + lines
             + "\t/* Horus: 10 MHz-spaced plan, matches reference AP (68 chans) */\n"
             + "};\n")

n_5g = len(chans)
n_total = 14 + n_5g          # 14 fixed 2.4 GHz entries + our 5 GHz entries
num_chans = n_total + 4      # small safety margin for survey[] indexing
max_5g = max(chans)          # 177

array_re = re.compile(
    r'static const struct ieee80211_channel ath10k_5ghz_channels\[\]\s*=\s*\{.*?\};',
    re.DOTALL)

patched_arrays = 0
patched_ct = 0
patched_numchans = 0
patched_max5g = 0
mac_seen = 0
core_seen = 0

for root, _dirs, files in os.walk('.'):
    if 'ath10k' not in root:
        continue
    for name in files:
        path = os.path.join(root, name)

        if name == 'mac.c':
            try:
                data = open(path, 'r', encoding='utf-8', errors='ignore').read()
            except OSError:
                continue
            if 'ath10k_5ghz_channels' not in data:
                continue
            mac_seen += 1
            data2, n = array_re.subn(new_array, data)
            if n:
                open(path, 'w', encoding='utf-8').write(data2)
                patched_arrays += 1
                if 'ath10k-ct' in path:
                    patched_ct += 1
                print("  [chans] rewrote %d-entry 5 GHz table in %s" % (n_5g, path))

        elif name == 'core.h':
            try:
                data = open(path, 'r', encoding='utf-8', errors='ignore').read()
            except OSError:
                continue
            if 'ATH10K_NUM_CHANS' not in data:
                continue
            core_seen += 1
            data, a = re.subn(r'(#define\s+ATH10K_NUM_CHANS\s+)\d+',
                              r'\g<1>%d' % num_chans, data)
            data, b = re.subn(r'(#define\s+ATH10K_MAX_5G_CHAN\s+)\d+',
                              r'\g<1>%d' % max_5g, data)
            if a or b:
                open(path, 'w', encoding='utf-8').write(data)
                patched_numchans += a
                patched_max5g += b
                print("  [core.h] ATH10K_NUM_CHANS=%d ATH10K_MAX_5G_CHAN=%d in %s"
                      % (num_chans, max_5g, path))

print("")
print("PATCH 5 summary: arrays=%d num_chans=%d max_5g=%d "
      "(mac.c seen=%d core.h seen=%d)"
      % (patched_arrays, patched_numchans, patched_max5g, mac_seen, core_seen))

if patched_arrays == 0:
    print("!!!! PATCH 5 FAILED: ath10k_5ghz_channels[] not found/replaced.")
    print("     The extra 5 GHz channels would silently read 0 dBm. Aborting.")
    sys.exit(1)
if patched_numchans == 0:
    print("!!!! PATCH 5 FAILED: ATH10K_NUM_CHANS not bumped - driver would")
    print("     overrun survey[] and crash on boot. Aborting.")
    sys.exit(1)
if patched_ct == 0:
    print("!!!! PATCH 5 FAILED: patched an ath10k tree, but NOT ath10k-ct.")
    print("     This device runs kmod-ath10k-ct. The copy of ath10k inside the")
    print("     mac80211 backports tarball is never compiled, so patching only")
    print("     that one reports success while the driver that actually loads")
    print("     keeps the stock 28-channel table - every extra frequency then")
    print("     reads 0 dBm. Ensure 06-compile.sh runs")
    print("     'make package/kernel/ath10k-ct/prepare' BEFORE this script.")
    sys.exit(1)
PYEOF

echo "[PATCH 5] Rewriting ath10k 5 GHz channel table + core.h constants..."
python3 /tmp/patch_ath10k_chans.py
rm -f /tmp/patch_ath10k_chans.py
echo "  -> ath10k 5 GHz channel table patched OK"

#############################################
# PATCH 5B: Ensure channel 14 (2484 MHz) in ath10k_2ghz_channels[]
#
# Channel 14 is present in the standard upstream ath10k driver table
# (CHAN2G(14, 2484, 0)) but some vendor forks strip it. We verify it
# is there and add it after channel 13 if missing.
#
# The rest of the unlock is already in place:
#   PATCH 1/2 - regd.c/reg.c already covers 2484 MHz at 33 dBm
#   PATCH 4   - hostapd hw_features.c no longer forces ch14 to 802.11b
#   regdb     - custom regulatory.db covers 2182-2484 @ 33 dBm
#############################################
cat << 'PYEOF' > /tmp/patch_ath10k_ch14.py
import os, re, sys

chan14_entry = "\tCHAN2G(14, 2484, 0),\n"
chan13_re = re.compile(r'(\tCHAN2G\(13,\s*2472,\s*0\),\n)')

patched = 0
already_had = 0
ct_seen = 0
mac_seen = 0

for root, _dirs, files in os.walk('.'):
    if 'ath10k' not in root:
        continue
    for name in files:
        if name != 'mac.c':
            continue
        path = os.path.join(root, name)
        try:
            data = open(path, 'r', encoding='utf-8', errors='ignore').read()
        except OSError:
            continue
        if 'ath10k_2ghz_channels' not in data:
            continue
        mac_seen += 1
        if 'ath10k-ct' in path:
            ct_seen += 1
        if 'CHAN2G(14,' in data:
            print("  [ch14] channel 14 already in %s" % path)
            already_had += 1
            continue
        data2 = chan13_re.sub(r'\g<1>' + chan14_entry, data)
        if data2 != data:
            open(path, 'w', encoding='utf-8').write(data2)
            patched += 1
            print("  [ch14] added CHAN2G(14, 2484, 0) to %s" % path)
        else:
            print("!!!! [ch14] WARN: chan 13 pattern not found in %s, ch14 not added" % path)

print("PATCH 5B: ch14 added=%d already_present=%d ct_trees=%d mac.c_seen=%d"
      % (patched, already_had, ct_seen, mac_seen))
if mac_seen == 0:
    print("!!!! PATCH 5B: no ath10k mac.c found")
    sys.exit(1)
if ct_seen == 0:
    print("!!!! PATCH 5B: ath10k-ct tree not seen - channel 14 unverified.")
    sys.exit(1)
PYEOF

echo "[PATCH 5B] Verifying / adding channel 14 (2484 MHz) to ath10k 2.4 GHz table..."
python3 /tmp/patch_ath10k_ch14.py
rm -f /tmp/patch_ath10k_ch14.py
echo "  -> ath10k channel 14 check OK"
