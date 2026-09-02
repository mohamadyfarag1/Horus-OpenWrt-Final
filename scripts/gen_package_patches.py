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

CHANS = list(range(36, 147, 2)) + list(range(149, 166, 2)) + [169, 173, 177]
N_2G = 14                       # ath10k registers 2.4 GHz channels 1..14
NUM_CHANS = N_2G + len(CHANS) + 4   # survey[] size, with a small margin
MAX_5G = max(CHANS)             # 177


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
    if not os.path.isfile(core):
        fail("core.h not next to %s" % mac)
    print("  ath10k-ct build dir : %s" % pkg_build_dir)
    print("  driver subdirectory : %s" % subname)

    old_mac = open(mac, encoding="utf-8", errors="ignore").read()
    old_core = open(core, encoding="utf-8", errors="ignore").read()

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
    # The array's own comment warns that adding entries REQUIRES growing
    # ATH10K_NUM_CHANS; otherwise the driver walks off the end of survey[].
    new_core, a = re.subn(r"(#define\s+ATH10K_NUM_CHANS\s+)\d+",
                          r"\g<1>%d" % NUM_CHANS, old_core)
    new_core, b = re.subn(r"(#define\s+ATH10K_MAX_5G_CHAN\s+)\d+",
                          r"\g<1>%d" % MAX_5G, new_core)
    if not a:
        fail("ATH10K_NUM_CHANS is not a plain '#define NAME <int>' in %s - "
             "raising it by hand is mandatory, the driver would overrun "
             "survey[] and crash on boot" % core)
    if not b:
        fail("ATH10K_MAX_5G_CHAN not found in %s" % core)
    print("  core.h              : ATH10K_NUM_CHANS=%d ATH10K_MAX_5G_CHAN=%d"
          % (NUM_CHANS, MAX_5G))

    header = (
        "Horus: register the reference AP's 10 MHz-spaced 5 GHz channel plan.\n"
        "\n"
        "ath10k builds its channel list from ath10k_5ghz_channels[]. Upstream\n"
        "ships it 20 MHz-spaced (%d entries); the reference AP for this device\n"
        "uses %d entries - 36..146 step 2, 149..165 step 2, then 169/173/177 -\n"
        "and reports 30 dBm on every one of them. freq = 5000 + 5*channel.\n"
        "\n"
        "ATH10K_NUM_CHANS sizes survey[], so it has to grow with the table or\n"
        "the driver indexes past the end of the array.\n"
        % (array_re.search(old_mac).group(0).count("CHAN5G"), len(CHANS)))

    entries = [(os.path.join(subname, "mac.c").replace(os.sep, "/"), old_mac, new_mac),
               (os.path.join(subname, "core.h").replace(os.sep, "/"), old_core, new_core)]
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
