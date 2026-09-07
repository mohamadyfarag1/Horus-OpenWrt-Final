#!/bin/sh
# art-backup.sh — ART calibration partition backup/verify tool
# ART is at /dev/mtdX labeled "ART", 64 KB, read-only
#   precal@0x1000 (size 0x2F20) → phy0 = 2.4 GHz radio
#   precal@0x5000 (size 0x2F20) → phy1 = 5 GHz radio
#   macaddr@0x0006 (6 bytes)    → base MAC address

BACKUP_DIR="/etc/art-backup"
BACKUP_FILE="$BACKUP_DIR/art.bin"

art_mtd() {
    grep -l "ART" /sys/class/mtd/*/name 2>/dev/null | head -1 | sed 's|/sys/class/mtd/||; s|/name||'
}

art_mtddev() {
    local m
    m=$(art_mtd)
    [ -z "$m" ] && { echo "ERROR: ART partition not found in /proc/mtd" >&2; return 1; }
    echo "/dev/$m"
}

cmd_info() {
    local dev mac b0 b1 b2 b3 b4 b5
    dev=$(art_mtddev) || return 1

    echo "ART Partition Info"
    echo "=================="
    echo "Device : $dev"
    echo "Size   : $(cat /sys/class/mtd/$(art_mtd)/size 2>/dev/null || echo 65536) bytes"
    echo ""

    # MAC address at offset 0x6
    mac=$(dd if="$dev" bs=1 skip=6 count=6 2>/dev/null | hexdump -v -e '1/1 "%02x:"' | sed 's/:$//')
    echo "Base MAC       : $mac"

    # Magic bytes of each calibration block (first 2 bytes should be 0xA5 0x5A for QCA)
    b0=$(dd if="$dev" bs=1 skip=4096 count=2 2>/dev/null | hexdump -v -e '1/1 "%02x"')
    b1=$(dd if="$dev" bs=1 skip=20480 count=2 2>/dev/null | hexdump -v -e '1/1 "%02x"')
    echo "precal@0x1000  : magic=0x${b0} (phy0/2.4G — $([ "$b0" = "a55a" ] && echo OK || echo BAD/BLANK))"
    echo "precal@0x5000  : magic=0x${b1} (phy1/5G   — $([ "$b1" = "a55a" ] && echo OK || echo BAD/BLANK))"

    if [ -f "$BACKUP_FILE" ]; then
        echo ""
        echo "Backup : $BACKUP_FILE ($(stat -c '%s' "$BACKUP_FILE" 2>/dev/null) bytes, $(stat -c '%y' "$BACKUP_FILE" 2>/dev/null | cut -d. -f1))"
    else
        echo ""
        echo "Backup : none — run: art-backup.sh save"
    fi
}

cmd_save() {
    local dev sz
    dev=$(art_mtddev) || return 1
    sz=$(cat /sys/class/mtd/$(art_mtd)/size 2>/dev/null || echo 65536)

    mkdir -p "$BACKUP_DIR"
    dd if="$dev" of="$BACKUP_FILE" bs=1024 2>/dev/null
    echo "Saved ${sz} bytes → $BACKUP_FILE"
    echo "Keep this file safe — it contains the unique RF calibration for this unit."
    echo "If the ART partition is ever erased, flash it back with: art-backup.sh restore"
}

cmd_verify() {
    local dev tmpfile diff_out
    dev=$(art_mtddev) || return 1

    if [ ! -f "$BACKUP_FILE" ]; then
        echo "No backup found at $BACKUP_FILE — run: art-backup.sh save" >&2
        return 1
    fi

    tmpfile=$(mktemp /tmp/art_live.XXXXXX)
    dd if="$dev" of="$tmpfile" bs=1024 2>/dev/null

    if cmp -s "$BACKUP_FILE" "$tmpfile"; then
        echo "ART partition matches backup — no changes detected"
        rm -f "$tmpfile"
        return 0
    else
        echo "WARNING: ART partition differs from backup!"
        echo "Changed bytes:"
        cmp -l "$BACKUP_FILE" "$tmpfile" | awk '{ printf "  offset 0x%04x: backup=0x%02x live=0x%02x\n", $1-1, strtonum("0"$2), strtonum("0"$3) }' | head -20
        rm -f "$tmpfile"
        return 1
    fi
}

cmd_restore() {
    local dev
    dev=$(art_mtddev) || return 1

    if [ ! -f "$BACKUP_FILE" ]; then
        echo "No backup found at $BACKUP_FILE" >&2
        return 1
    fi

    echo "WARNING: This will write to $dev (ART partition)."
    echo "This is a read-only partition on most boards. Proceed only if you know what you are doing."
    printf "Type YES to continue: "
    read -r ans
    [ "$ans" = "YES" ] || { echo "Aborted."; return 1; }

    mtd write "$BACKUP_FILE" ART && echo "ART partition restored from $BACKUP_FILE" || {
        echo "mtd write failed — trying dd (may fail on read-only partition)"
        dd if="$BACKUP_FILE" of="$dev" bs=1024
    }
}

case "$1" in
    info|"")  cmd_info ;;
    save)     cmd_save ;;
    verify)   cmd_verify ;;
    restore)  cmd_restore ;;
    *)
        echo "Usage: art-backup.sh [info|save|verify|restore]"
        echo "  info    — show ART partition details and calibration magic bytes"
        echo "  save    — backup ART to $BACKUP_FILE"
        echo "  verify  — compare live ART with saved backup"
        echo "  restore — write backup back to ART partition (dangerous)"
        exit 1
        ;;
esac
