#!/bin/bash
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

for HWF in $(find . -path "*/hostapd*/src/ap/hw_features.c" -o -path "*/wpad*/src/ap/hw_features.c" 2>/dev/null); do
  echo "[PATCH 4] Patching: $HWF"
  sed -i 's/wpa_printf(MSG_INFO, "Disable OFDM\/HT\/VHT on channel 14");//g' "$HWF"
  sed -i 's/iface->conf->hw_mode = HOSTAPD_MODE_IEEE80211B;/iface->conf->hw_mode = HOSTAPD_MODE_IEEE80211G;/g' "$HWF"
  sed -i '/iface->conf->ieee80211n = 0;/d' "$HWF"
  sed -i '/iface->conf->ieee80211ac = 0;/d' "$HWF"
  echo "  -> hostapd/hw_features.c patched OK"
done

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
PYEOF

echo "[PATCH 5] Rewriting ath10k 5 GHz channel table + core.h constants..."
python3 /tmp/patch_ath10k_chans.py
rm -f /tmp/patch_ath10k_chans.py
echo "  -> ath10k 5 GHz channel table patched OK"
