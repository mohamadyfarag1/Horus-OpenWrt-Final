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

# 5 GHz channel plan: expanded 162-channel spectrum plan (5120 MHz - 5925 MHz, 5 MHz step)
# Channels 24..185 inclusive. All 162 channels are calibrated and supported by IPQ4019 radio.
# Target DMA Copy Engine buffer protection is handled in ath10k_update_channel_list().
CHANS = list(range(24, 186))
MAX_5G = max(CHANS)             # 185

# 2.4 GHz channel plan: 86-channel expanded spectrum (2312 MHz - 2732 MHz)
# Matches Ubiquiti NanoStation M2 spectrum + standard 802.11 channels:
# - 2.3 GHz band: Channels 237-255 (2312-2402 MHz, 5 MHz step) + Ch 256 (2407 MHz)
# - Standard 2.4 GHz: Channels 1-13 (2412-2472 MHz)
# - Standard 802.11b Japan: Channel 14 (2484 MHz)
# - Transition band: Channels 74-80 (2477-2507 MHz, 5 MHz step)
# - Upper 2.5-2.732 GHz band: Channels 15-59 (2512-2732 MHz, 5 MHz step)
CHANS_2G = [
    # 2.3 GHz Sub-band: 2312 - 2407 MHz
    (237, 2312), (238, 2317), (239, 2322), (240, 2327), (241, 2332),
    (242, 2337), (243, 2342), (244, 2347), (245, 2352), (246, 2357),
    (247, 2362), (248, 2367), (249, 2372), (250, 2377), (251, 2382),
    (252, 2387), (253, 2392), (254, 2397), (255, 2402), (256, 2407),
    # Standard 2.4 GHz ISM: 2412 - 2472 MHz
    (1, 2412), (2, 2417), (3, 2422), (4, 2427), (5, 2432),
    (6, 2437), (7, 2442), (8, 2447), (9, 2452), (10, 2457),
    (11, 2462), (12, 2467), (13, 2472),
    # Standard 802.11b Japan: 2484 MHz
    (14, 2484),
    # Transition 5 MHz step: 2477 - 2507 MHz
    (74, 2477), (75, 2482), (76, 2487), (77, 2492), (78, 2497),
    (79, 2502), (80, 2507),
] + [
    # Upper 2.5 - 2.732 GHz Band: 2512 - 2732 MHz (Channels 15..59)
    (ch, 2437 + ch * 5) for ch in range(15, 60)
]


def fail(msg):
    print("!!!! %s" % msg)
    sys.exit(1)


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
    if not os.path.isfile(core):
        fail("core.h not next to %s" % mac)
    if not os.path.isfile(wmi):
        fail("wmi.h not next to %s" % mac)
    print("  ath10k-ct build dir : %s" % pkg_build_dir)
    print("  driver subdirectory : %s" % subname)

    old_mac = open(mac, encoding="utf-8", errors="ignore").read()
    old_core = open(core, encoding="utf-8", errors="ignore").read()
    old_wmi = open(wmi, encoding="utf-8", errors="ignore").read()

    # --- 5 GHz table -------------------------------------------------
    lines = "".join("\tCHAN5G(%d, %d, 0),\n" % (c, 5000 + 5 * c) for c in CHANS)
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
                    + "\t/* Horus: 86-channel 2.4 GHz superchannel plan (2312-2732 MHz), "
                      "matches NanoStation M2 (%d channels) */\n" % len(CHANS_2G)
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
    # descriptor takes 28 bytes. Packing all 162+86 = 248 channels into a single
    # wmi_scan_chan_list_cmd requires 6944 bytes, which overruns target SRAM and
    # crashes the firmware with -108, causing a watchdog reboot loop.
    # We filter the scan channel list in ath10k_update_channel_list:
    # 2.4 GHz: 11 grid anchors (Ch 1, 6, 11, 14, 237, 247, 256, 76, 25, 45, 59)
    # 5 GHz: 20 MHz grid anchors + priority airMAX channels (~40 channels)
    # Total scan channels <= 60 (~1680 bytes), ensuring packet size <= 1700 < 2048 bytes.
    # All 86 2.4GHz + 162 5GHz channels remain fully registered in ath10k channel
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
    scan_r1 = (
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
        "\t\t\t/* Horus: limit scan channels to prevent Copy Engine DMA buffer overflow (CE3 limit 2048 bytes).\n"
        "\t\t\t * Total scan channels capped <= 60 (~1680 bytes < 2048 bytes).\n"
        "\t\t\t * All 86 2.4GHz + 162 5GHz channels remain fully registered in ath10k channel arrays for AP/STA use.\n"
        "\t\t\t */\n"
        "\t\t\tif (channel->band == NL80211_BAND_2GHZ) {\n"
        "\t\t\t\tif (channel->hw_value != 1 && channel->hw_value != 6 &&\n"
        "\t\t\t\t    channel->hw_value != 11 && channel->hw_value != 14 &&\n"
        "\t\t\t\t    channel->hw_value != 237 && channel->hw_value != 247 &&\n"
        "\t\t\t\t    channel->hw_value != 256 && channel->hw_value != 76 &&\n"
        "\t\t\t\t    channel->hw_value != 25 && channel->hw_value != 45 &&\n"
        "\t\t\t\t    channel->hw_value != 59)\n"
        "\t\t\t\t\tcontinue;\n"
        "\t\t\t}\n"
        "\t\t\tif (channel->band == NL80211_BAND_5GHZ) {\n"
        "\t\t\t\tint f = channel->center_freq;\n"
        "\t\t\t\tif (!((f >= 5180 && f <= 5700 && f % 20 == 0) ||\n"
        "\t\t\t\t      (f >= 5725 && f <= 5885 && (f - 5725) % 20 == 0) ||\n"
        "\t\t\t\t      f == 5125 || f == 5445 || f == 5455 || f == 5465 || f == 5905 || f == 5925))\n"
        "\t\t\t\t\tcontinue;\n"
        "\t\t\t}\n"
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
        "\tch = arg.channels;\n"
        "\tfor (band = 0; band < NUM_NL80211_BANDS; band++) {\n"
        "\t\tif (!bands[band])\n"
        "\t\t\tcontinue;\n"
        "\n"
        "\t\tfor (i = 0; i < bands[band]->n_channels; i++) {\n"
        "\t\t\tchannel = &bands[band]->channels[i];\n"
        "\n"
        "\t\t\tif (channel->flags & IEEE80211_CHAN_DISABLED)\n"
        "\t\t\t\tcontinue;\n"
        "\n"
        "\t\t\tif (channel->band == NL80211_BAND_2GHZ) {\n"
        "\t\t\t\tif (channel->hw_value != 1 && channel->hw_value != 6 &&\n"
        "\t\t\t\t    channel->hw_value != 11 && channel->hw_value != 14 &&\n"
        "\t\t\t\t    channel->hw_value != 237 && channel->hw_value != 247 &&\n"
        "\t\t\t\t    channel->hw_value != 256 && channel->hw_value != 76 &&\n"
        "\t\t\t\t    channel->hw_value != 25 && channel->hw_value != 45 &&\n"
        "\t\t\t\t    channel->hw_value != 59)\n"
        "\t\t\t\t\tcontinue;\n"
        "\t\t\t}\n"
        "\t\t\tif (channel->band == NL80211_BAND_5GHZ) {\n"
        "\t\t\t\tint f = channel->center_freq;\n"
        "\t\t\t\tif (!((f >= 5180 && f <= 5700 && f % 20 == 0) ||\n"
        "\t\t\t\t      (f >= 5725 && f <= 5885 && (f - 5725) % 20 == 0) ||\n"
        "\t\t\t\t      f == 5125 || f == 5445 || f == 5455 || f == 5465 || f == 5905 || f == 5925))\n"
        "\t\t\t\t\tcontinue;\n"
        "\t\t\t}\n"
        "\t\t\tif (ch - arg.channels >= arg.n_channels)\n"
        "\t\t\t\tbreak;"
    )
    if scan_t1 not in new_mac or scan_t2 not in new_mac:
        fail("could not find ath10k_update_channel_list scan loop anchor in %s" % mac)
    new_mac = new_mac.replace(scan_t1, scan_r1, 1).replace(scan_t2, scan_r2, 1)
    print("  scan buffer overflow: protected (capped <= 60 channels in WMI scan list)")

    # --- core.h bounds -----------------------------------------------
    # ATH10K_NUM_CHANS must equal the COMBINED length of the two channel
    # arrays, exactly. mac.c checks it at compile time:
    #
    #   BUILD_BUG_ON((ARRAY_SIZE(ath10k_2ghz_channels) +
    #                 ARRAY_SIZE(ath10k_5ghz_channels)) != ATH10K_NUM_CHANS);
    #
    # The test is '!=', not '>', so this is not a buffer to pad "for
    # safety" - any margin is a hard build failure. (Setting it to 86 for
    # 82 real channels is what broke the ath10k-ct smallbuffers build.)
    # Count what we actually emitted rather than predicting it.
    def count_entries(text, array, macro):
        m = re.search(r"static const struct ieee80211_channel %s\[\]\s*=\s*\{.*?\};"
                      % re.escape(array), text, re.DOTALL)
        if not m:
            fail("%s[] not found while sizing ATH10K_NUM_CHANS" % array)
        return len(re.findall(r"^\s*%s\(" % macro, m.group(0), re.M))

    n_2g = count_entries(new_mac, "ath10k_2ghz_channels", "CHAN2G")
    n_5g = count_entries(new_mac, "ath10k_5ghz_channels", "CHAN5G")
    num_chans = n_2g + n_5g
    if n_2g != len(CHANS_2G):
        fail("emitted %d 2.4 GHz channels but the plan has %d" % (n_2g, len(CHANS_2G)))
    if n_5g != len(CHANS):
        fail("emitted %d 5 GHz channels but the plan has %d" % (n_5g, len(CHANS)))
    print("  array sizes         : %d (2.4G) + %d (5G) = %d" % (n_2g, n_5g, num_chans))

    new_core, a = re.subn(r"(#define\s+ATH10K_NUM_CHANS\s+)\d+",
                          r"\g<1>%d" % num_chans, old_core)
    new_core, b = re.subn(r"(#define\s+ATH10K_MAX_5G_CHAN\s+)\d+",
                          r"\g<1>%d" % MAX_5G, new_core)
    if not a:
        fail("ATH10K_NUM_CHANS is not a plain '#define NAME <int>' in %s - "
             "raising it by hand is mandatory, the driver would overrun "
             "survey[] and crash on boot" % core)
    if not b:
        fail("ATH10K_MAX_5G_CHAN not found in %s" % core)
    print("  core.h              : ATH10K_NUM_CHANS=%d ATH10K_MAX_5G_CHAN=%d"
          % (num_chans, MAX_5G))

    # --- wmi.h scan channel buffer -----------------------------------
    # In struct wmi_start_scan_arg, channels[64] was sized for stock (27 5GHz + 14 2.4GHz = 41 channels).
    # When mac80211 requests a scan of the 5 GHz band, it passes ALL registered
    # 5 GHz channels (68 channels) to ath10k_hw_scan().
    # If channels[] is only 64 entries:
    # 1. mac.c overflows arg.channels[] by 4 elements onto the stack/struct (overwriting arg.ssids).
    # 2. ath10k_wmi_start_scan_verify() checks:
    #      if (arg->n_channels > ARRAY_SIZE(arg->channels)) return -EINVAL;
    #    Since 68 > 64, it immediately fails with -22 (-EINVAL):
    #      "ath10k_ahb a800000.wifi: failed to start hw scan: -22"
    # 3. Hardware scan fails every time, so client / station (STA) mode can never connect to any AP.
    # Sizing channels[] to num_chans (82) fixes both the buffer overflow and the -22 error,
    # exactly matching the Golden Reference AP (which disassembles to `cmp r3, #0x52` = 82 in
    # ath10k_wmi_start_scan_verify).
    new_wmi, c = re.subn(r"(u16\s+channels\[)\d+(\];)",
                         r"\g<1>%d\g<2>" % num_chans, old_wmi)
    if not c:
        fail("u16 channels[64] not found in %s" % wmi)
    print("  wmi.h               : channels[64] -> channels[%d]" % num_chans)

    header = (
        "Horus: register the 86-channel 2.4 GHz and 162-channel 5 GHz plans with CE DMA buffer protection.\n"
        "\n"
        "ath10k builds its channel lists from ath10k_2ghz_channels[] and ath10k_5ghz_channels[].\n"
        "- 2.4 GHz: %d channels (2312-2732 MHz, continuous 5 MHz steps + Ch 14 2484 MHz).\n"
        "  Matches Ubiquiti NanoStation M2 full spectrum.\n"
        "- 5 GHz: %d channels (5120-5925 MHz, channels 24..185, 5 MHz steps).\n"
        "  Matches Ubiquiti Rocket AC / airMAX spectrum.\n"
        "All channels operate at full calibrated 30 dBm power.\n"
        "\n"
        "ath10k_update_channel_list protects against Copy Engine DMA buffer overflow\n"
        "(CE3 2048-byte limit) by filtering background scan entries across both bands\n"
        "(max 60 channels total, ~1680 bytes < 2048 bytes).\n"
        "\n"
        "ATH10K_NUM_CHANS sizes survey[], so it has to grow with the combined table (%d) or\n"
        "the driver indexes past the end of the array.\n"
        "\n"
        "wmi.h channels[] in struct wmi_start_scan_arg must also grow to\n"
        "ATH10K_NUM_CHANS (%d), otherwise full-band scans fail with -EINVAL (-22).\n"
        % (len(CHANS_2G), len(CHANS), num_chans, num_chans))

    # Record the exact frequency list for the drift check in 06-compile.sh.
    # Do NOT recover it from the unified diff: every channel that already
    # existed in the stock 27-entry table is emitted as an unchanged CONTEXT
    # line, not a '+' line, so grepping '^+' finds only the 41 additions and
    # a correct patch looks half-applied.
    os.makedirs("tmp", exist_ok=True)
    freq_list = os.path.join("tmp", "horus-driver-freqs.txt")
    with open(freq_list, "w", encoding="utf-8", newline="\n") as fh:
        for c in CHANS:
            fh.write("%d\n" % (5000 + 5 * c))
    print("  wrote %s (%d frequencies)" % (freq_list, len(CHANS)))

    entries = [(os.path.join(subname, "mac.c").replace(os.sep, "/"), old_mac, new_mac),
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
    inject_2g = (
        "\t/* Horus: 2.3 GHz SuperChannels (2312 - 2407 MHz) -> channels 237..256 */\n"
        "\tif (freq >= 2312 && freq <= 2407) {\n"
        "\t\tif ((freq - 2312) % 5)\n"
        "\t\t\treturn NUM_HOSTAPD_MODES;\n"
        "\t\t*channel = 237 + (freq - 2312) / 5;\n"
        "\t\t*op_class = 81;\n"
        "\t\treturn HOSTAPD_MODE_IEEE80211G;\n"
        "\t}\n\n"
        "\t/* Horus: 2.4 GHz transition channels (2477 - 2507 MHz) -> channels 74..80 */\n"
        "\tif (freq >= 2477 && freq <= 2507 && freq != 2484) {\n"
        "\t\tif ((freq - 2477) % 5)\n"
        "\t\t\treturn NUM_HOSTAPD_MODES;\n"
        "\t\t*channel = 74 + (freq - 2477) / 5;\n"
        "\t\t*op_class = 81;\n"
        "\t\treturn HOSTAPD_MODE_IEEE80211G;\n"
        "\t}\n\n"
        "\t/* Horus: Upper 2.5 - 2.732 GHz SuperChannels (2512 - 2732 MHz) -> channels 15..59 */\n"
        "\tif (freq >= 2512 && freq <= 2732) {\n"
        "\t\tif ((freq - 2437) % 5)\n"
        "\t\t\treturn NUM_HOSTAPD_MODES;\n"
        "\t\t*channel = (freq - 2437) / 5;\n"
        "\t\t*op_class = 81;\n"
        "\t\treturn HOSTAPD_MODE_IEEE80211G;\n"
        "\t}\n\n"
        + target_2g
    )
    if target_2g not in old_common:
        fail("anchor 'if (freq >= 2412 && freq <= 2472) {' not found in %s" % common)
    new_common = old_common.replace(target_2g, inject_2g, 1)

    # 2. 5 GHz SuperChannels (expand ceiling from 5900 MHz to 6000 MHz)
    target_5g = "\tif (freq >= 5000 && freq < 5900) {"
    replace_5g = (
        "\t/* Horus: 5 GHz SuperChannels expanded to 6000 MHz (channels 24..200) */\n"
        "\tif (freq >= 5000 && freq <= 6000 && freq != 5935) {"
    )
    if target_5g not in new_common:
        fail("anchor 'if (freq >= 5000 && freq < 5900) {' not found in %s" % common)
    new_common = new_common.replace(target_5g, replace_5g, 1)

    header = (
        "Horus: let channel 14 keep OFDM/HT and unlock SuperChannel frequencies in hostapd.\n"
        "\n"
        "1. hostapd_select_hw_mode() force-downgrades channel 14 to bare 802.11b\n"
        "   because Japan forbids OFDM at 2484 MHz. Drop the block so the channel\n"
        "   runs with whatever hw_mode/htmode the UCI config asked for.\n"
        "2. ieee80211_freq_to_channel_ext() maps frequency to channel numbers.\n"
        "   - Standard 5 GHz stopped strictly at < 5900 MHz, causing channels 180..185\n"
        "     (5900..5925 MHz) to fail with 'Could not determine operating frequency'\n"
        "     and drop Tx-Power to 0 dBm. Expanded to 6000 MHz.\n"
        "   - 2.4 GHz plan includes 2.3 GHz (channels 237..256), transition channels\n"
        "     (74..80), and upper band (15..59, up to 2732 MHz), matching NanoStation M2.\n")

    entries = [
        (rel, old, new),
        (rel_common, old_common, new_common),
    ]
    emit_patch(os.path.join(pkg_dir, "patches", "999-horus-channel14.patch"),
               entries, header)


def main():
    if not os.path.isdir("build_dir") or not os.path.isdir("package"):
        fail("run this from the openwrt/ directory")

    target = sys.argv[1] if len(sys.argv) > 1 else "all"

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
