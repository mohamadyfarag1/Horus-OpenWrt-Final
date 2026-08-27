#!/bin/sh
# Re-enable existing USB Extroot by Antigravity (Auto-Sync)
echo "Checking USB compatibility..."

USB_PART=$(block info | grep -oE 
'
/dev/sd[a-z][0-9]
'
 | head -n 1)
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
        echo "⚠️ Firmware Mismatch Detected! Syncing new kernel modules to USB..."
        mkdir -p "$CHECK_DIR/lib/modules/$CURRENT_KERNEL"
        cp -a /lib/modules/$CURRENT_KERNEL/* "$CHECK_DIR/lib/modules/$CURRENT_KERNEL/" 2>/dev/null
    fi
fi
umount /tmp/usb_check 2>/dev/null

echo "✅ USB is ready. Re-enabling existing USB Extroot..."
uci set fstab.overlay.enabled="1" 2>/dev/null
uci commit fstab 2>/dev/null
sync
echo "Done! The router will now reboot to boot from the USB flash drive."
echo "Please wait 2 minutes for the router to come back online."
sleep 3
reboot

