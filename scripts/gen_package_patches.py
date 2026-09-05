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

# 5 GHz channel plan: 5 MHz step spacing across the safe calibrated band (5120 MHz - 5925 MHz)
# Formula: freq = 5000 + 5 * channel
# Channel 24 = 5120 MHz ... Channel 185 = 5925 MHz (162 channels)
# Matching Ubiquiti airMAX AC / Rocket Prism 5AC 5 MHz channel resolution
CHANS = list(range(24, 186))
# ATH10K_NUM_CHANS is NOT a free parameter and NOT a buffer size to pad.
# mac.c enforces it at compile time with an equality test, so it is derived
# from the arrays at generation time - see patch_ath10k().
MAX_5G = max(CHANS)             # 185


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
                 + "\t/* Horus: 5 MHz-spaced plan matching Ubiquiti spectrum resolution "
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

    # --- channel 14 --------------------------------------------------
    # Upstream already carries CHAN2G(14, 2484, 0); add it only if a fork
    # stripped it. Whether it is usable is a regulatory question, handled
    # by 09-generate-regdb.sh emitting 2182-2494.
    g2 = re.search(r"static const struct ieee80211_channel ath10k_2ghz_channels\[\]"
                   r"\s*=\s*\{.*?\};", new_mac, re.DOTALL)
    if g2 and "CHAN2G(14," not in g2.group(0):
        new_mac = new_mac.replace(
            "\tCHAN2G(13, 2472, 0),\n",
            "\tCHAN2G(13, 2472, 0),\n\tCHAN2G(14, 2484, 0),\n", 1)
        print("  channel 14          : added")
    else:
        print("  channel 14          : already present upstream")

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
        "Horus: register 5 MHz-spaced 5 GHz channel plan matching Ubiquiti AC resolution.\n"
        "\n"
        "ath10k builds its channel list from ath10k_5ghz_channels[]. Upstream\n"
        "ships it 20 MHz-spaced (%d entries); Horus expands it to %d entries -\n"
        "channels 24..185 in 5 MHz steps (5120 MHz - 5925 MHz) -\n"
        "and reports 30 dBm across the calibrated spectrum. freq = 5000 + 5*channel.\n"
        "\n"
        "ATH10K_NUM_CHANS sizes survey[], so it has to grow with the table or\n"
        "the driver indexes past the end of the array.\n"
        "\n"
        "wmi.h channels[] in struct wmi_start_scan_arg must also grow to\n"
        "ATH10K_NUM_CHANS (%d), otherwise full-band scans (>64 channels) fail with\n"
        "-EINVAL (-22): 'failed to start hw scan: -22'.\n"
        % (array_re.search(old_mac).group(0).count("CHAN5G"), len(CHANS), num_chans))

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

    header = (
        "Horus: let channel 14 keep OFDM/HT.\n"
        "\n"
        "hostapd_select_hw_mode() force-downgrades channel 14 to bare 802.11b\n"
        "because Japan forbids OFDM at 2484 MHz. Drop the block so the channel\n"
        "runs with whatever hw_mode/htmode the UCI config asked for.\n"
        "\n"
        "This only decides the MODE. Whether channel 14 is usable at all is a\n"
        "regulatory question: a 20 MHz channel centred on 2484 needs a rule\n"
        "covering 2474-2494, which is why 09-generate-regdb.sh emits 2182-2494\n"
        "rather than stopping at 2484.\n")

    emit_patch(os.path.join(pkg_dir, "patches", "999-horus-channel14.patch"),
               [(rel, old, new)], header)


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
