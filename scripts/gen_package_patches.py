#!/usr/bin/env python3
"""
Turn the ath10k-ct and hostapd source edits into real OpenWrt package
patches.

WHY THIS EXISTS
---------------
07-unlock-superchannel.sh edits sources in place, under build_dir, after a
`make ... /prepare`. For mac80211 that is fine - it has no build variants,
so there is exactly one backports tree and the edit is the tree that gets
compiled.

ath10k-ct and hostapd are different. Both declare VARIANTs (ath10k-ct:
regular + smallbuffers; hostapd: 37 of them, and we build wpad-openssl =
full-openssl). include/package.mk gives every variant its own build dir:

    PKG_BUILD_DIR ?= $(BUILD_DIR)/$(if $(BUILD_VARIANT),$(PKG_NAME)-$(BUILD_VARIANT)/)$(PKG_NAME)-$(PKG_VERSION)

so a plain `make package/kernel/ath10k-ct/prepare` unpacks one directory,
the in-place edit lands there, and the full build then unpacks the variant
we actually ship into a *different, pristine* directory and compiles that.
The patch is simply not in the driver that boots. That is why the shipped
image had the stock 27-channel 5 GHz table while LuCI offered 68: picking
any of the extra channels left hostapd with a frequency the driver never
registered, the interface refused to start, and the radio went quiet -
the "power drops to zero" report.

THE FIX
-------
Generate the same edits as a unified diff and drop it into the package's
own patches/ directory. OpenWrt then applies it inside Build/Prepare, for
every variant, every time the source is unpacked. Ordering, stamps and
variant directories all stop mattering.

The diff is generated against an already-prepared tree, i.e. after
OpenWrt's own 001-..988- patches have been applied, and is numbered 999-
so it always applies last. Run from the openwrt/ directory.
"""

import difflib
import os
import re
import sys

_BLOCKS_5G = [
    (184, 4920, 17), (16, 5080, 205),   # 5110 - 6010 -> ch 22..202
]


def build_5g_plan():
    plan = []
    for first_ch, first_freq, count in _BLOCKS_5G:
        for i in range(count):
            plan.append((first_ch + i, first_freq + 5 * i))
    return sorted(plan, key=lambda cf: cf[1])


CHANS_5G = build_5g_plan()
CHANS = [c for c, f in CHANS_5G]
MIN_5G = min(CHANS)
MAX_5G = max(CHANS)

# 2.4 GHz channel plan: 2312 MHz - 2682 MHz in 5 MHz steps, plus 2484 MHz.
#
# The channel NUMBERS matter as much as the frequencies. ath10k decides which
# band a received management frame belongs to from the channel number alone
# (ath10k_wmi_event_mgmt_rx: patched to MIN_5G..MAX_5G is 5 GHz,
# anything else is 2.4 GHz).
#
# So 2.4 GHz is confined to numbers OUTSIDE the 5 GHz range (16..237):
# 1..15 and 238..299.
# Each block below is a plain linear map, because the identical arithmetic has to
# be reproduced in the kernel (net/wireless/util.c) and in hostapd
# (ieee80211_freq_to_channel_ext) - see build_2g_plan() for the single source.
_BLOCKS_2G = [
    # (first_channel, first_freq, count)  -- ascending in frequency
    (238, 2312, 20),   # 2312 - 2407 -> ch 238..257
    (1,   2412, 13),   # 2412 - 2472 -> ch 1..13
    (15,  2477, 1),    # 2477        -> ch 15
    (258, 2482, 1),    # 2482        -> ch 258
    (14,  2484, 1),    # 2484        -> ch 14
    (259, 2487, 5),    # 2487 - 2507 -> ch 259..263
    (264, 2512, 45),   # 2512 - 2732 -> ch 264..308
]


def build_2g_plan():
    plan = []
    for first_ch, first_freq, count in _BLOCKS_2G:
        for i in range(count):
            plan.append((first_ch + i, first_freq + 5 * i))
    return sorted(plan, key=lambda cf: cf[1])


CHANS_2G = build_2g_plan()

# Background-scan anchors for the 2.4 GHz band. The full table cannot be handed
# to the firmware (CE3 DMA limit, see patch_ath10k), so the offload scan only
# gets these. Selected by FREQUENCY rather than channel number so that
# renumbering the plan can never silently empty the list.
SCAN_ANCHORS_2G = [2312, 2352, 2412, 2437, 2462, 2484,
                   2512, 2552, 2592, 2632, 2682]


def c_freq_to_chan_2g(indent, var, assign, ok, bad, skip_freqs=()):
    """Emit C that maps a 2.4 GHz `freq` to our channel number.

    Both the kernel (net/wireless/util.c, ieee80211_freq_khz_to_channel) and
    hostapd (ieee80211_freq_to_channel_ext) have to agree on this mapping, and
    when they disagreed nothing worked: the kernel registered channel -19 for
    2312 MHz while hostapd asked for 237. Generating both from _BLOCKS_2G is
    the only way to keep them identical.

    `assign` is a format string taking the channel expression, `ok` and `bad`
    are the statements to emit on a hit and on a misaligned frequency.
    """
    i = indent
    out = []
    for first_ch, first_freq, count in _BLOCKS_2G:
        if first_freq in skip_freqs:
            continue
        last_freq = first_freq + 5 * (count - 1)
        if count == 1:
            out.append("%sif (%s == %d) {\n" % (i, var, first_freq))
            out.append("%s\t%s\n" % (i, assign % str(first_ch)))
            out.append("%s\t%s\n" % (i, ok))
            out.append("%s}\n" % i)
            continue
        out.append("%sif (%s >= %d && %s <= %d) {\n" % (i, var, first_freq, var, last_freq))
        out.append("%s\tif ((%s - %d) %% 5)\n" % (i, var, first_freq))
        out.append("%s\t\t%s\n" % (i, bad))
        out.append("%s\t%s\n" % (i, assign % ("%d + (%s - %d) / 5"
                                              % (first_ch, var, first_freq))))
        out.append("%s\t%s\n" % (i, ok))
        out.append("%s}\n" % i)
    return "".join(out)


def c_chan_to_freq_2g(indent, var, ret):
    """Emit C that maps one of our 2.4 GHz channel numbers back to a frequency.

    The inverse of c_freq_to_chan_2g(). cfg80211 needs both directions;
    ieee80211_channel_to_freq_khz() is what turns a UCI `option channel` into
    the frequency the radio is actually told to tune.
    """
    i = indent
    out = []
    for first_ch, first_freq, count in _BLOCKS_2G:
        last_ch = first_ch + count - 1
        if count == 1:
            out.append("%sif (%s == %d)\n" % (i, var, first_ch))
            out.append("%s\t%s\n" % (i, ret % str(first_freq)))
            continue
        out.append("%sif (%s >= %d && %s <= %d)\n" % (i, var, first_ch, var, last_ch))
        out.append("%s\t%s\n" % (i, ret % ("%d + (%s - %d) * 5"
                                           % (first_freq, var, first_ch))))
    return "".join(out)


def c_freq_to_chan_5g(indent, var, assign, ok, bad):
    """Emit C that maps a 5 GHz `freq` to our channel number.

    Generated from _BLOCKS_5G so that the kernel (net/wireless/util.c),
    hostapd (ieee80211_freq_to_channel_ext), and ath10k-ct stay in 100% sync.
    """
    i = indent
    out = []
    for first_ch, first_freq, count in _BLOCKS_5G:
        last_freq = first_freq + 5 * (count - 1)
        out.append("%sif (%s >= %d && %s <= %d) {\n" % (i, var, first_freq, var, last_freq))
        out.append("%s\tif ((%s - %d) %% 5)\n" % (i, var, first_freq))
        out.append("%s\t\t%s\n" % (i, bad))
        out.append("%s\t%s\n" % (i, assign % ("%d + (%s - %d) / 5"
                                              % (first_ch, var, first_freq))))
        if ok:
            out.append("%s\t%s\n" % (i, ok))
        out.append("%s}\n" % i)
    return "".join(out)


def c_chan_to_freq_5g(indent, var, ret):
    """Emit C that maps one of our 5 GHz channel numbers back to a frequency."""
    i = indent
    out = []
    for first_ch, first_freq, count in _BLOCKS_5G:
        last_ch = first_ch + count - 1
        out.append("%sif (%s >= %d && %s <= %d)\n" % (i, var, first_ch, var, last_ch))
        out.append("%s\t%s\n" % (i, ret % ("%d + (%s - %d) * 5"
                                           % (first_freq, var, first_ch))))
    return "".join(out)


def c_scan_filter_2g():
    """The 2.4 GHz half of the ath10k_update_channel_list scan filter."""
    known = {f for _, f in CHANS_2G}
    missing = [f for f in SCAN_ANCHORS_2G if f not in known]
    if missing:
        fail("scan anchors %s are not in the 2.4 GHz plan" % missing)
    tests = ["f != %d" % f for f in SCAN_ANCHORS_2G]
    lines = []
    for i in range(0, len(tests), 2):
        lines.append(" && ".join(tests[i:i + 2]))
    body = " &&\n\t\t\t\t    ".join(lines)
    return ("\t\t\tif (channel->band == NL80211_BAND_2GHZ) {\n"
            "\t\t\t\tint f = channel->center_freq;\n"
            "\t\t\t\tif (" + body + ")\n"
            "\t\t\t\t\tcontinue;\n"
            "\t\t\t}\n")


def fail(msg):
    print("!!!! %s" % msg)
    sys.exit(1)


def validate_plans():
    """Refuse to generate a plan the driver cannot represent.

    Every one of these has already shipped as a silent runtime failure at least
    once, so they are hard errors at generation time rather than review notes.
    """
    nums_2g = [ch for ch, _ in CHANS_2G]
    freqs_2g = [f for _, f in CHANS_2G]

    dupes = {n for n in nums_2g if nums_2g.count(n) > 1}
    if dupes:
        fail("duplicate 2.4 GHz channel numbers: %s" % sorted(dupes))
    dupes = {f for f in freqs_2g if freqs_2g.count(f) > 1}
    if dupes:
        fail("duplicate 2.4 GHz frequencies: %s" % sorted(dupes))

    # The collision that broke every extended 2.4 GHz channel: ath10k reads the
    # band off the channel number, so the two tables must not share numbers.
    clash = sorted(set(nums_2g) & set(CHANS))
    if clash:
        fail("2.4 GHz channel numbers %s collide with the 5 GHz range %d..%d - "
             "ath10k_wmi_event_mgmt_rx would tag those frames as 5 GHz and drop "
             "the association" % (clash, MIN_5G, MAX_5G))

    if min(nums_2g) < 1:
        fail("2.4 GHz channel numbers must stay > 0, got min %d"
             % min(nums_2g))

    total = len(CHANS) + len(CHANS_2G)
    # The firmware has been protected from buffer overflows via the scan batching fix.
    # We can now comfortably support 308+ channels.

    print("  plan validated      : %d (5G, ch %d..%d) + %d (2.4G) = %d channels"
          % (len(CHANS), MIN_5G, MAX_5G, len(CHANS_2G), total))
    freqs_5g = [f for _, f in CHANS_5G]
    print("  5 GHz span          : %d - %d MHz" % (min(freqs_5g), max(freqs_5g)))
    print("  2.4 GHz span        : %d - %d MHz" % (min(freqs_2g), max(freqs_2g)))


def find_file(root, name, must_contain):
    """First file called `name` under `root` whose text contains a marker."""
    for base, _dirs, files in os.walk(root):
        if name not in files:
            continue
        path = os.path.join(base, name)
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as fh:
                if must_contain in fh.read():
                    return path
        except OSError:
            continue
    return None


def emit_patch(out_path, entries, header):
    """entries: list of (relpath, old_text, new_text)."""
    chunks = []
    for rel, old, new in entries:
        if old == new:
            fail("no change produced for %s - refusing to write an empty patch" % rel)
        diff = difflib.unified_diff(
            old.splitlines(keepends=True),
            new.splitlines(keepends=True),
            fromfile="a/" + rel,
            tofile="b/" + rel,
            n=3,
        )
        chunks.append("".join(diff))

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(header.rstrip("\n") + "\n\n")
        fh.write("".join(chunks))
    print("  wrote %s (%d file(s))" % (out_path, len(entries)))


# ---------------------------------------------------------------------
# ath10k-ct: the 5 GHz channel table + the survey[] bounds in core.h
# ---------------------------------------------------------------------
def read_ct_kver(pkg_dir):
    """Which ath10k-X.Y subdirectory the package actually compiles.

    The ath10k-ct tarball ships a full source tree per upstream kernel
    (ath10k-6.2, ath10k-6.4, ath10k-6.10, ...) and EVERY one of them
    defines ath10k_5ghz_channels[]. Only the one named by CT_KVER is built
    (PKG_EXTMOD_SUBDIRS / Build/Compile both use it), so patching any other
    one is a no-op that still looks like success.
    """
    mk = os.path.join(pkg_dir, "Makefile")
    try:
        text = open(mk, encoding="utf-8", errors="ignore").read()
    except OSError:
        fail("cannot read %s to determine CT_KVER" % mk)
    m = re.search(r'^\s*CT_KVER\s*[:?]?=\s*"?([^"\s]+)"?\s*$', text, re.M)
    if not m:
        fail("CT_KVER not found in %s - cannot tell which ath10k-X.Y "
             "subdirectory is compiled" % mk)
    return "ath10k" + m.group(1)


def patch_ath10k(build_dir, pkg_dir):
    subname_want = read_ct_kver(pkg_dir)
    print("  CT_KVER subdirectory: %s" % subname_want)

    mac = None
    for base, _dirs, files in os.walk(build_dir):
        if os.path.basename(base) != subname_want or "mac.c" not in files:
            continue
        cand = os.path.join(base, "mac.c")
        with open(cand, encoding="utf-8", errors="ignore") as fh:
            if "ath10k_5ghz_channels[]" in fh.read():
                mac = cand
                break
    if not mac:
        fail("%s/mac.c (with ath10k_5ghz_channels[]) not found under %s - was "
             "'make package/kernel/ath10k-ct/prepare' run?" % (subname_want, build_dir))

    # <PKG_BUILD_DIR>/ath10k-<CT_KVER>/mac.c  ->  PKG_BUILD_DIR is two up
    sub = os.path.dirname(mac)
    pkg_build_dir = os.path.dirname(sub)
    subname = os.path.basename(sub)
    core = os.path.join(sub, "core.h")
    wmi = os.path.join(sub, "wmi.h")
    wmic = os.path.join(sub, "wmi.c")
    if not os.path.isfile(core):
        fail("core.h not next to %s" % mac)
    if not os.path.isfile(wmi):
        fail("wmi.h not next to %s" % mac)
    if not os.path.isfile(wmic):
        fail("wmi.c not next to %s" % mac)
    print("  ath10k-ct build dir : %s" % pkg_build_dir)
    print("  driver subdirectory : %s" % subname)

    old_mac = open(mac, encoding="utf-8", errors="ignore").read()
    old_core = open(core, encoding="utf-8", errors="ignore").read()
    old_wmi = open(wmi, encoding="utf-8", errors="ignore").read()
    old_wmic = open(wmic, encoding="utf-8", errors="ignore").read()

    # --- 5 GHz table -------------------------------------------------
    lines = "".join("\tCHAN5G(%d, %d, 0),\n" % (c, f) for c, f in CHANS_5G)
    new_array = ("static const struct ieee80211_channel ath10k_5ghz_channels[] = {\n"
                 + lines
                 + "\t/* Horus: 10 MHz-spaced plan, matches the reference AP "
                   "(%d channels) */\n" % len(CHANS)
                 + "};\n")
    array_re = re.compile(
        r"static const struct ieee80211_channel ath10k_5ghz_channels\[\]\s*=\s*\{.*?\};",
        re.DOTALL)
    new_mac, n = array_re.subn(new_array, old_mac)
    if not n:
        fail("ath10k_5ghz_channels[] did not match in %s" % mac)
    print("  5 GHz table         : %d -> %d channels"
          % (array_re.search(old_mac).group(0).count("CHAN5G"), len(CHANS)))

    # --- 2.4 GHz table -----------------------------------------------
    lines_2g = "".join("\tCHAN2G(%d, %d, 0),\n" % (ch, freq) for ch, freq in CHANS_2G)
    new_array_2g = ("static const struct ieee80211_channel ath10k_2ghz_channels[] = {\n"
                    + lines_2g
                    + "\t/* Horus: 2.4 GHz SuperChannel plan, %d channels, %d - %d MHz. "
                      "Numbers stay outside the 5 GHz range on purpose. */\n"
                      % (len(CHANS_2G), min(f for _, f in CHANS_2G),
                         max(f for _, f in CHANS_2G))
                    + "};\n")
    array_2g_re = re.compile(
        r"static const struct ieee80211_channel ath10k_2ghz_channels\[\]\s*=\s*\{.*?\};",
        re.DOTALL)
    new_mac, n2 = array_2g_re.subn(new_array_2g, new_mac)
    if not n2:
        fail("ath10k_2ghz_channels[] did not match in %s" % mac)
    print("  2.4 GHz table       : %d -> %d channels"
          % (array_2g_re.search(old_mac).group(0).count("CHAN2G") if array_2g_re.search(old_mac) else 14, len(CHANS_2G)))

    # --- CE buffer overflow protection in ath10k_update_channel_list ---
    # The IPQ4019 firmware Copy Engine CE3 (Host->Target WMI) has a maximum buffer
    # size of 2048 bytes (src_sz_max = 2048). In TLV firmware, each scan channel
    # descriptor takes 28 bytes. Packing every registered channel into a single
    # wmi_scan_chan_list_cmd requires 6944 bytes, which overruns target SRAM and
    # crashes the firmware with -108, causing a watchdog reboot loop.
    # We filter the scan channel list in ath10k_update_channel_list:
    # 2.4 GHz: anchors picked by frequency, see SCAN_ANCHORS_2G
    # 5 GHz: 20 MHz grid anchors + priority airMAX channels (~40 channels)
    # Total scan channels <= 60 (~1680 bytes), ensuring packet size <= 1700 < 2048 bytes.
    # All registered channels remain fully registered in ath10k channel
    # arrays for normal AP and STA operation.
    scan_t1 = (
        "\tbands = hw->wiphy->bands;\n"
        "\tfor (band = 0; band < NUM_NL80211_BANDS; band++) {\n"
        "\t\tif (!bands[band])\n"
        "\t\t\tcontinue;\n"
        "\n"
        "\t\tfor (i = 0; i < bands[band]->n_channels; i++) {\n"
        "\t\t\tif (bands[band]->channels[i].flags &\n"
        "\t\t\t    IEEE80211_CHAN_DISABLED)\n"
        "\t\t\t\tcontinue;\n"
        "\n"
        "\t\t\targ.n_channels++;\n"
        "\t\t}\n"
        "\t}"
    )
    new_mac = new_mac.replace(

        "static int ath10k_update_channel_list(struct ath10k *ar)\n{",
        "void *horus_ar[4] = {0};\n"
        "int horus_active_scan_count[4] = {0};\n"
        "int horus_active_scan_freqs[4][82] = {0};\n"
        "static int get_horus_idx(void *ar) {\n"
        "\tint i; for (i=0; i<4; i++) { if (horus_ar[i] == ar) return i; if (horus_ar[i] == NULL) { horus_ar[i] = ar; return i; } } return 0;\n"
        "}\n"
        "static int ath10k_update_channel_list(struct ath10k *ar)\n{\n"
        "\tint h_idx = get_horus_idx((void*)ar);\n"
        "static int ath10k_update_channel_list(struct ath10k *ar)\n{\n"
        
                "\tunsigned int horus_skip_count = 0, horus_skipped = 0;\n"
        "\tint active_freqs[8] = {0};\n"
        "\tint num_active = 0;\n"
    )

    scan_r1 = (
        "\t/* Horus: Smart round-robin channel scan batches */\n"
        "\t/* Protect active and scanning channels from rotation */\n"
        "\tif (ar->rx_channel) {\n"
        "\t\tactive_freqs[num_active++] = ar->rx_channel->center_freq;\n"
        "\t}\n"
        "\tif (ar->scan_channel) {\n"
        "\t\tbool dup = false;\n"
        "\t\tif (num_active > 0 && active_freqs[0] == ar->scan_channel->center_freq) dup = true;\n"
        "\t\tif (!dup) active_freqs[num_active++] = ar->scan_channel->center_freq;\n"
        "\t}\n"
        "\tbands = hw->wiphy->bands;\n"
        "\tfor (band = 0; band < NUM_NL80211_BANDS; band++) {\n"
        "\t\tif (bands[band]) {\n"
        "\t\t\tfor (i = 0; i < bands[band]->n_channels; i++) {\n"
        "\t\t\t\tif (!(bands[band]->channels[i].flags & IEEE80211_CHAN_DISABLED)) {\n"
        "\t\t\t\t\tbool is_active = false;\n"
        "\t\t\t\t\tint k;\n"
        "\t\t\t\t\tfor (k = 0; k < num_active; k++) {\n"
        "\t\t\t\t\t\tif (bands[band]->channels[i].center_freq == active_freqs[k]) { is_active = true; break; }\n"
        "\t\t\t\t\t}\n"
        "\t\t\t\t\tif (!is_active) horus_rotatable++;\n"
        "\t\t\t\t}\n"
        "\t\t\t}\n"
        "\t\t}\n"
        "\t}\n"
        "\tif (horus_rotatable > 0) {\n"
        "\t\tunsigned int slots = 60 - num_active;\n"
        "\t\tunsigned int num_cycles;\n"
        "\t\tif (slots == 0 || slots > 60) slots = 1;\n"
        "\t\tnum_cycles = (horus_rotatable + (slots - 1)) / slots;\n"
        "\t\thorus_scan_cycle = (horus_scan_cycle + 1) % num_cycles;\n"
        "\t\thorus_skip_count = horus_scan_cycle * slots;\n"
        "\t}\n"
        "\tbands = hw->wiphy->bands;\n"
        "\tfor (band = 0; band < NUM_NL80211_BANDS; band++) {\n"
        "\t\tif (!bands[band])\n"
        "\t\t\tcontinue;\n"
        "\n"
        "\t\tfor (i = 0; i < bands[band]->n_channels; i++) {\n"
        "\t\t\tchannel = &bands[band]->channels[i];\n"
        "\t\t\tif (channel->flags &\n"
        "\t\t\t    IEEE80211_CHAN_DISABLED)\n"
        "\t\t\t\tcontinue;\n"
        "\n"
        "\t\t\t{\n"
        "\t\t\t\tbool is_active = false;\n"
        "\t\t\t\tint k;\n"
        "\t\t\t\tfor (k = 0; k < num_active; k++) {\n"
        "\t\t\t\t\tif (channel->center_freq == active_freqs[k]) { is_active = true; break; }\n"
        "\t\t\t\t}\n"
        "\t\t\t\tif (!is_active) {\n"
        "\t\t\t\t\tif (horus_skipped < horus_skip_count) {\n"
        "\t\t\t\t\t\thorus_skipped++;\n"
        "\t\t\t\t\t\tcontinue;\n"
        "\t\t\t\t\t}\n"
        "\t\t\t\t}\n"
        "\t\t\t}\n"
        "\n"
        "\t\t\tif (arg.n_channels >= 60)\n"
        "\t\t\t\tbreak;\n"
        "\n"
        "\t\t\targ.n_channels++;\n"
        "\t\t}\n"
        "\t}"
    )
    scan_t2 = (
        "\tch = arg.channels;\n"
        "\tfor (band = 0; band < NUM_NL80211_BANDS; band++) {\n"
        "\t\tif (!bands[band])\n"
        "\t\t\tcontinue;\n"
        "\n"
        "\t\tfor (i = 0; i < bands[band]->n_channels; i++) {\n"
        "\t\t\tchannel = &bands[band]->channels[i];\n"
        "\n"
        "\t\t\tif (channel->flags & IEEE80211_CHAN_DISABLED)\n"
        "\t\t\t\tcontinue;"
    )
    scan_r2 = (
        "bool keep = false;
"
        "						int freq = bands[band]->channels[i].center_freq;
"
        "						if (horus_active_scan_count[h_idx] > 0) {
"
        "							int k; for(k=0; k<horus_active_scan_count[h_idx]; k++) { if (horus_active_scan_freqs[h_idx][k] == freq) { keep = true; break; } }
"
        "						} else {
"
        "							if (is_active) keep = true;
"
        "							else if (freq < 3000) {
"
        "								if (freq % 20 == 12 || freq % 20 == 2) keep = true; /* 2412, 2432, 2452, 2472... */
"
        "							} else if (freq >= 4920) {
"
        "								if (freq % 20 == 0) keep = true;
"
        "							}
"
        "							if (!keep && arg.n_channels < 60) {
"
        "								/* Rotate remaining slots */
"
        "								if (horus_skipped < horus_skip_count) horus_skipped++;
"
        "								else keep = true;
"
        "							}
"
        "						}
"
        "						if (keep && arg.n_channels < 60) {
"
        "							arg.channels[arg.n_channels++] = freq;
"
        "						}
"
        "					}
"
    ) as fh:
        for c, f in CHANS_5G:
            fh.write("%d\n" % f)
    print("  wrote %s (%d frequencies)" % (freq_list, len(CHANS)))

    entries = [(os.path.join(subname, "wmi.c").replace(os.sep, "/"), old_wmic, new_wmic),
               (os.path.join(subname, "mac.c").replace(os.sep, "/"), old_mac, new_mac),
               (os.path.join(subname, "core.h").replace(os.sep, "/"), old_core, new_core),
               (os.path.join(subname, "wmi.h").replace(os.sep, "/"), old_wmi, new_wmi)]
    emit_patch(os.path.join(pkg_dir, "patches", "999-horus-superchannels.patch"),
               entries, header)


# ---------------------------------------------------------------------
# hostapd: stop forcing channel 14 down to bare 802.11b
# ---------------------------------------------------------------------
def patch_hostapd(build_dir, pkg_dir):
    hw = find_file(build_dir, "hw_features.c", "on channel 14")
    if not hw:
        fail("hostapd hw_features.c with the channel 14 block not found under "
             + build_dir)

    # <PKG_BUILD_DIR>/src/ap/hw_features.c
    pkg_build_dir = os.path.dirname(os.path.dirname(os.path.dirname(hw)))
    rel = "src/ap/hw_features.c"
    print("  hostapd build dir   : %s" % pkg_build_dir)

    old = open(hw, encoding="utf-8", errors="ignore").read()

    mark = re.search(r'wpa_printf\(MSG_INFO,\s*"Disable OFDM[^"]*on channel 14"\);', old)
    if not mark:
        fail("channel 14 log marker not found in %s" % hw)

    if_at = old.rfind("if (", 0, mark.start())
    if if_at == -1:
        fail("no enclosing if() before the channel 14 marker")
    body_at = old.find("{", if_at)
    if body_at == -1 or body_at > mark.start():
        fail("could not locate the channel 14 block body")

    depth = 0
    close_at = None
    for i in range(body_at, len(old)):
        if old[i] == "{":
            depth += 1
        elif old[i] == "}":
            depth -= 1
            if depth == 0:
                close_at = i
                break
    if close_at is None:
        fail("unbalanced braces around the channel 14 block")

    block = old[if_at:close_at + 1]
    if "channel == 14" not in block:
        fail("the matched block is not the channel 14 block:\n" + block[:400])

    new = (old[:if_at]
           + "/* Horus: channel 14 keeps the configured hw_mode/HT.\n"
             "\t * Upstream forced 802.11b here for JP regulatory. */"
           + old[close_at + 1:])

    # --- src/common/ieee802_11_common.c (SuperChannel freq-to-chan mapping) ---
    common = find_file(build_dir, "ieee802_11_common.c", "ieee80211_freq_to_channel_ext")
    if not common:
        fail("hostapd ieee802_11_common.c with ieee80211_freq_to_channel_ext not found under "
             + build_dir)
    rel_common = os.path.relpath(common, pkg_build_dir).replace(os.sep, "/")
    old_common = open(common, encoding="utf-8", errors="ignore").read()

    # 1. 2.4 GHz SuperChannels (2.3 GHz - 2.732 GHz)
    target_2g = "\tif (freq >= 2412 && freq <= 2472) {"
    # The standard 2412-2472 block below the anchor already handles channels
    # 1..13, so skip that block here and let upstream keep it.
    inject_2g = (
        "\t/* Horus SuperChannel 2.4 GHz plan (%d - %d MHz).\n"
        "\t * Must stay identical to ieee80211_freq_khz_to_channel() in the\n"
        "\t * kernel, otherwise cfg80211 registers one channel number and\n"
        "\t * hostapd asks for another and the radio never comes up. */\n"
        % (min(f for _, f in CHANS_2G), max(f for _, f in CHANS_2G))
        + c_freq_to_chan_2g(
            "\t",
            "freq",
            assign="*channel = %s;",
            ok="*op_class = 81;\n\t\treturn HOSTAPD_MODE_IEEE80211G;",
            bad="return NUM_HOSTAPD_MODES;",
            skip_freqs=(2412,))
        + "\n"
        + target_2g
    )
    if target_2g not in old_common:
        fail("anchor 'if (freq >= 2412 && freq <= 2472) {' not found in %s" % common)
    new_common = old_common.replace(target_2g, inject_2g, 1)

    # 2. 5 GHz SuperChannels (5110 - 6010 MHz, 181 channels)
    target_5g = "\tif (freq >= 5000 && freq < 5900) {"
    inject_5g = (
        "\t/* Horus SuperChannel 5 GHz plan (%d - %d MHz, %d channels).\n"
        "\t * Generated from _BLOCKS_5G in scripts/gen_package_patches.py.\n"
        "\t * Must stay identical to ieee80211_freq_khz_to_channel() in the\n"
        "\t * kernel and ath10k-ct driver table. */\n"
        % (min(f for _, f in CHANS_5G), max(f for _, f in CHANS_5G), len(CHANS_5G))
        + c_freq_to_chan_5g(
            "\t",
            "freq",
            assign="*channel = %s;",
            ok="*op_class = 115;\n\t\treturn HOSTAPD_MODE_IEEE80211A;",
            bad="return NUM_HOSTAPD_MODES;")
        + "\n"
        + target_5g
    )
    if target_5g not in new_common:
        fail("anchor 'if (freq >= 5000 && freq < 5900) {' not found in %s" % common)
    new_common = new_common.replace(target_5g, inject_5g, 1)

    # --- src/common/hw_features_common.c (Annex J HT40 pair whitelist) ---
    #
    # allowed_ht40_channel_pair() rejects any 40 MHz pair whose lower
    # channel number is not one of a hardcoded list of 16 standard 20 MHz
    # grid starting points (36, 44, 52, ... 192). This is IEEE 802.11n
    # Annex J - it exists to keep 40 MHz bonding on the standard channel
    # grid, and it runs AFTER mac80211.sh has already picked a primary and
    # a driver-registered, in-plan secondary channel. On the SuperChannel
    # 5 MHz-spaced plan almost no pair's lower channel matches one of
    # those 16 numbers, so hostapd rejects the pair outright and falls
    # back to plain 20 MHz - this is why even the in-range default
    # (channel 185, secondary 181) silently downgraded from VHT80 to
    # HT20 with "HT40 channel pair (185, 181) not allowed" in the log,
    # even though both channels are registered, in bounds, and legal
    # under the custom regulatory rule.
    hwc = find_file(build_dir, "hw_features_common.c", "HT40 channel pair")
    if not hwc:
        fail("hostapd hw_features_common.c with allowed_ht40_channel_pair() "
             "not found under " + build_dir)
    rel_hwc = os.path.relpath(hwc, pkg_build_dir).replace(os.sep, "/")
    old_hwc = open(hwc, encoding="utf-8", errors="ignore").read()

    target_annexj = (
        "\t/*\n"
        "\t * Verify that HT40 primary,secondary channel pair is allowed per\n"
        "\t * IEEE 802.11n Annex J. This is only needed for 5 GHz band since\n"
        "\t * 2.4 GHz rules allow all cases where the secondary channel fits into\n"
        "\t * the list of allowed channels (already checked above).\n"
        "\t */\n"
        "\tif (mode != HOSTAPD_MODE_IEEE80211A)\n"
        "\t\treturn 1;\n"
        "\n"
        "\tfirst = pri_chan < sec_chan ? pri_chan : sec_chan;\n"
        "\n"
        "\tok = 0;\n"
        "\tfor (k = 0; k < ARRAY_SIZE(allowed); k++) {\n"
        "\t\tif (first == allowed[k]) {\n"
        "\t\t\tok = 1;\n"
        "\t\t\tbreak;\n"
        "\t\t}\n"
        "\t}\n"
        "\tif (!ok) {\n"
        "\t\twpa_printf(MSG_ERROR, \"HT40 channel pair (%d, %d) not allowed\",\n"
        "\t\t\t   pri_chan, sec_chan);\n"
        "\t\treturn 0;\n"
        "\t}\n"
        "\n"
        "\treturn 1;\n"
    )
    replace_annexj = (
        "\t/* Horus: Annex J only permits 40 MHz bonding on the standard 20 MHz\n"
        "\t * grid (36, 44, 52, ...). The SuperChannel plan is a continuous 5 MHz\n"
        "\t * grid instead, so this whitelist would reject almost every pair we\n"
        "\t * hand it even though the secondary channel was already verified\n"
        "\t * driver-registered and in-plan above. (void) the now-unused locals\n"
        "\t * to keep this building clean with -Werror. */\n"
        "\t(void)mode;\n"
        "\t(void)first;\n"
        "\t(void)ok;\n"
        "\t(void)k;\n"
        "\t(void)allowed;\n"
        "\n"
        "\treturn 1;\n"
    )
    if target_annexj not in old_hwc:
        fail("Annex J whitelist block not found verbatim in %s - "
             "upstream hostapd source changed, patch needs updating" % hwc)
    new_hwc = old_hwc.replace(target_annexj, replace_annexj, 1)

    header = (
        "Horus: let channel 14 keep OFDM/HT, unlock SuperChannel frequencies in\n"
        "hostapd, and drop the Annex J standard-grid whitelist for HT40/VHT pairs.\n"
        "\n"
        "1. hostapd_select_hw_mode() force-downgrades channel 14 to bare 802.11b\n"
        "   because Japan forbids OFDM at 2484 MHz. Drop the block so the channel\n"
        "   runs with whatever hw_mode/htmode the UCI config asked for.\n"
        "2. ieee80211_freq_to_channel_ext() maps frequency to channel numbers.\n"
        "   - Standard 5 GHz stopped strictly at < 5900 MHz, causing the channels\n"
        "     above it to fail with 'Could not determine operating frequency'\n"
        "     and drop Tx-Power to 0 dBm. Expanded to 6000 MHz.\n"
        "   - The 2.4 GHz mapping is generated from the same table as the kernel\n"
        "     side (net/wireless/util.c), so cfg80211 and hostapd agree on every\n"
        "     channel number. They did not before, and nothing could associate.\n"
        "3. allowed_ht40_channel_pair() rejected any 40 MHz pair whose lower\n"
        "   channel wasn't one of 16 hardcoded standard grid points (Annex J).\n"
        "   Almost no SuperChannel pair matches, so 40/80 MHz silently fell back\n"
        "   to 20 MHz even for in-bounds, driver-registered, regulatory-legal\n"
        "   pairs (observed live: 'HT40 channel pair (185, 181) not allowed').\n"
        "   The secondary channel's own legality (driver-registered, in-plan,\n"
        "   not DISABLED) is already verified earlier in the same function;\n"
        "   this only removed the extra standard-grid-position requirement.\n")

    entries = [
        (rel, old, new),
        (rel_common, old_common, new_common),
        (rel_hwc, old_hwc, new_hwc),
    ]
    emit_patch(os.path.join(pkg_dir, "patches", "999-horus-channel14.patch"),
               entries, header)


def write_5g_bounds():
    """Hand the plan's limits to the netifd wireless layer.

    /lib/netifd/horus_wireless.sh sources this file and every Horus helper
    reads its bounds from it: the band-edge clamp needs the channel numbers,
    and the station scan sweep needs the frequency span. Hardcoding any of
    them alongside the plan is how they go stale - and stale bounds do not
    fail the build, they just make hostapd ask for a channel ath10k never
    registered. So emit all of them from the plan, and only from the plan.
    """
    freqs_2g = [f for _, f in CHANS_2G]
    freqs_5g = [f for _, f in CHANS_5G]
    min_5g_freq, max_5g_freq = min(freqs_5g), max(freqs_5g)
    min_2g_freq, max_2g_freq = min(freqs_2g), max(freqs_2g)

    # Sanitiser window for freq_list values. Deliberately wider than the plan:
    # inside it a value is plausibly MHz, outside it is almost certainly a
    # channel number the caller forgot to convert.
    sane_min = min(2300, min_2g_freq)
    sane_max = max(6000, max_5g_freq)

    out = os.path.join("files", "lib", "netifd", "horus-5g-bounds")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("# Generated by scripts/gen_package_patches.py - do not edit.\n"
                 "# Bounds of the registered channel plan, sourced by\n"
                 "# /lib/netifd/horus_wireless.sh.\n"
                 "\n"
                 "HORUS_5G_MIN_CHAN=%d\n"
                 "HORUS_5G_MAX_CHAN=%d\n"
                 "\n"
                 "HORUS_5G_MIN_FREQ=%d\n"
                 "HORUS_5G_MAX_FREQ=%d\n"
                 "\n"
                 "HORUS_2G_MIN_FREQ=%d\n"
                 "HORUS_2G_MAX_FREQ=%d\n"
                 "\n"
                 "HORUS_FREQ_SANE_MIN=%d\n"
                 "HORUS_FREQ_SANE_MAX=%d\n"
                 % (MIN_5G, MAX_5G,
                    min_5g_freq, max_5g_freq,
                    min_2g_freq, max_2g_freq,
                    sane_min, sane_max))
    print("  wrote %s (ch %d..%d, %d-%d / %d-%d MHz)"
          % (out, MIN_5G, MAX_5G,
             min_5g_freq, max_5g_freq, min_2g_freq, max_2g_freq))


def main():
    if not os.path.isdir("build_dir") or not os.path.isdir("package"):
        fail("run this from the openwrt/ directory")

    target = sys.argv[1] if len(sys.argv) > 1 else "all"

    print("[channel plan]")
    validate_plans()
    write_5g_bounds()

    if target in ("all", "ath10k"):
        print("[ath10k-ct]")
        patch_ath10k("build_dir", os.path.join("package", "kernel", "ath10k-ct"))
    if target in ("all", "hostapd"):
        print("[hostapd]")
        patch_hostapd("build_dir",
                      os.path.join("package", "network", "services", "hostapd"))
    return 0


if __name__ == "__main__":
    sys.exit(main())





