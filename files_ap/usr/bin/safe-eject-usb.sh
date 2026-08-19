#!/bin/sh
# Safe USB Ejection Script by Antigravity
echo "Preparing USB drive for safe removal..."
sync

# Disable fstab overlay so next boot uses internal NAND
uci set fstab.overlay.enabled="0" 2>/dev/null
uci commit fstab 2>/dev/null
sync

echo "Disk buffers flushed successfully."
echo "The router will now reboot into the internal NAND flash."
echo "You can safely unplug the USB flash drive after the reboot starts."
sleep 3
reboot
