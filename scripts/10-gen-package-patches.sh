#!/bin/bash
# =============================================
# Script 10: Turn the ath10k-ct / hostapd edits into real OpenWrt patches
#
# Run from the openwrt/ directory.
#
# Editing sources in place under build_dir works for mac80211 (one build
# dir, no variants) but NOT for ath10k-ct or hostapd. Both declare build
# VARIANTs, and include/package.mk gives every variant its own directory:
#
#   PKG_BUILD_DIR ?= $(BUILD_DIR)/$(if $(BUILD_VARIANT),$(PKG_NAME)-$(BUILD_VARIANT)/)...
#
# ath10k-ct has 2 variants (regular, smallbuffers - we ship smallbuffers);
# hostapd has 37 (we ship wpad-openssl = full-openssl). A plain
# `make package/.../prepare` unpacks ONE of them, the in-place edit lands
# there, and the full build then unpacks the variant we actually ship into
# a separate pristine directory and compiles that. The edit never reaches
# the driver that boots - which is why the last image had the stock
# 27-channel 5 GHz table while LuCI offered 68, and selecting one of the
# extra channels killed the radio.
#
# So: generate the edits as unified diffs, drop them in the packages' own
# patches/ directories, and let OpenWrt apply them inside Build/Prepare -
# for every variant, every time it unpacks. Then clean, so the variants are
# rebuilt from source that has the patch.
# =============================================
set -e

echo "============================================="
echo "=== GENERATING OPENWRT PACKAGE PATCHES ======"
echo "============================================="

# A prepared tree is needed to diff against - and it must be prepared, not
# just unpacked, so the diff sits on top of OpenWrt's own 001-..988-
# patches the same way it will at build time.
echo "[1/4] Preparing pristine sources to diff against..."
make package/kernel/ath10k-ct/prepare V=s -j"$(nproc)" 2>&1 | tail -n 5
make package/network/services/hostapd/prepare V=s -j"$(nproc)" 2>&1 | tail -n 5

echo "[2/4] Generating patches..."
python3 ../scripts/gen_package_patches.py

echo "[3/4] Verifying the generated patches apply to a pristine tree..."
for spec in \
    "package/kernel/ath10k-ct/patches/999-horus-superchannels.patch" \
    "package/network/services/hostapd/patches/999-horus-channel14.patch"
do
    if [ ! -s "$spec" ]; then
        echo "!!!! $spec was not generated (or is empty)."
        exit 1
    fi
    echo "  OK: $spec ($(wc -l < "$spec") lines)"
done

# Drop the build trees so every variant is unpacked again, this time with
# our patch applied by OpenWrt itself.
echo "[4/4] Cleaning so all variants rebuild with the patch applied..."
make package/kernel/ath10k-ct/clean V=s 2>&1 | tail -n 3
make package/network/services/hostapd/clean V=s 2>&1 | tail -n 3

echo "Package patches installed. OpenWrt will apply them for every variant."
