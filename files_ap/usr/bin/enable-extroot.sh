#!/bin/sh
# Re-enable existing USB Extroot by Antigravity (With Safety Check)
echo "Checking USB compatibility..."

USB_PART=$(block info | grep -oE '/dev/sd[a-z][0-9]' | head -n 1)
if [ -z "$USB_PART" ]; then
    echo "🔴 Error: No USB drive detected!"
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
        echo "🔴 ERROR: Firmware Mismatch Detected!"
        echo "The USB drive contains an older/different firmware version."
        echo "If enabled, it will crash the web interface (Error 404)."
        echo "Please use 'Format USB & Expand Space' to start fresh."
        umount /tmp/usb_check 2>/dev/null
        exit 1
    fi
fi
umount /tmp/usb_check 2>/dev/null

echo "✅ USB is compatible. Re-enabling existing USB Extroot..."
uci set fstab.overlay.enabled="1" 2>/dev/null
uci commit fstab 2>/dev/null
sync
echo "Done! The router will now reboot to boot from the USB flash drive."
echo "Please wait 2 minutes for the router to come back online."
sleep 3
reboot