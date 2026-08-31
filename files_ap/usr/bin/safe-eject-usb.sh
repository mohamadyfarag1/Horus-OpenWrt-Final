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
echo "DO NOT unplug the USB drive yet - it is still in use until the reboot finishes."
echo "Wait until the router is back online (LEDs stable / reachable again), THEN unplug it."
sleep 3
reboot
