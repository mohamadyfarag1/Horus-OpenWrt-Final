#!/bin/sh
# Re-enable existing USB Extroot by Antigravity
echo "Checking USB compatibility..."

USB_PART=$(block info | grep -oE '^/dev/sd[a-z][0-9]' | head -n 1)
if [ -z "$USB_PART" ]; then
    echo "🔴 Error: No USB drive detected!"
    exit 1
fi

FS_TYPE=$(block info | grep "^$USB_PART" | grep -oE 'TYPE="[^"]+"' | cut -d'"' -f2)

if [ "$FS_TYPE" != "ext4" ]; then
    echo "🔴 ERROR: Unsupported USB Format ($FS_TYPE)!"
    echo "The flash drive must be formatted as ext4 to be used for system expansion."
    echo "Please go use the 'Format USB & Expand Space' button first."
    exit 1
fi

mkdir -p /tmp/usb_check
mount "$USB_PART" /tmp/usb_check 2>/dev/null

CURRENT_KERNEL=$(uname -r)

if [ -d "/tmp/usb_check/upper" ]; then
    CHECK_DIR="/tmp/usb_check/upper"
else
    CHECK_DIR="/tmp/usb_check"
fi

if [ -d "$CHECK_DIR/lib/modules" ]; then
    if [ ! -d "$CHECK_DIR/lib/modules/$CURRENT_KERNEL" ]; then
        echo "⚠️ Syncing new kernel modules to USB..."
        mkdir -p "$CHECK_DIR/lib/modules/$CURRENT_KERNEL"
        cp -a /lib/modules/$CURRENT_KERNEL/* "$CHECK_DIR/lib/modules/$CURRENT_KERNEL/" 2>/dev/null
    fi
fi
umount /tmp/usb_check 2>/dev/null

echo "✅ USB is ready. Re-enabling existing USB Extroot..."
UUID=$(block info "$USB_PART" | grep -o -e 'UUID=\S*' | cut -d'=' -f2 | tr -d '"')
uci -q delete fstab.overlay
uci set fstab.overlay="mount"
uci set fstab.overlay.uuid="${UUID}"
uci set fstab.overlay.target="/overlay"
uci set fstab.overlay.enabled="1"
uci commit fstab
sync
echo "Done! The router will now reboot to boot from the USB flash drive."
echo "Please wait 2 minutes for the router to come back online."
sleep 3
reboot
