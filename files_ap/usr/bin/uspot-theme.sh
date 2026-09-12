#!/bin/sh
# ==============================================================================
# Horus-Spot — Hotspot Theme ZIP extractor
# ------------------------------------------------------------------------------
# Usage: uspot-theme.sh <path_to_uploaded_zip>
# ==============================================================================

ZIP_FILE="$1"
DEST_DIR="/www/uspot"

if [ -z "$ZIP_FILE" ] || [ ! -f "$ZIP_FILE" ]; then
    echo "Error: File not found."
    exit 1
fi

# Ensure destination exists
mkdir -p "$DEST_DIR"

# Clear old files (optional, but good for clean themes)
rm -rf "$DEST_DIR"/*

# Unzip the file
unzip -q -o "$ZIP_FILE" -d "$DEST_DIR"

# MikroTik users often zip the 'hotspot' folder itself instead of its contents.
# If after extraction, the only thing in DEST_DIR is a folder called 'hotspot',
# we should move its contents up one level.
if [ -d "$DEST_DIR/hotspot" ]; then
    mv "$DEST_DIR/hotspot"/* "$DEST_DIR"/ 2>/dev/null
    rm -rf "$DEST_DIR/hotspot"
fi

# Ensure permissions are correct for the web server
chmod -R 755 "$DEST_DIR"

# Delete the uploaded zip to save RAM/Space
rm -f "$ZIP_FILE"

exit 0
