#!/bin/sh
# Re-enable existing USB Extroot by Antigravity
echo "Re-enabling existing USB Extroot..."
uci set fstab.overlay.enabled="1" 2>/dev/null
uci commit fstab 2>/dev/null
sync
echo "Done! The router will now reboot to boot from the USB flash drive."
echo "Please wait 2 minutes for the router to come back online."
sleep 3
reboot