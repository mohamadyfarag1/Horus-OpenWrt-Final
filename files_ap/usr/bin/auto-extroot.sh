#!/bin/sh
# Auto-Extroot Script by Antigravity

echo "Starting Auto-Extroot setup..."

DEVICE="/dev/sda"

if [ ! -b "$DEVICE" ]; then
    echo "ERROR: No USB drive detected at $DEVICE!"
    echo "Make sure the USB drive is plugged in."
    exit 1
fi

echo "WARNING: This will completely erase the USB drive at $DEVICE."
echo "Formatting $DEVICE to ext4..."
mkfs.ext4 -F $DEVICE

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to format $DEVICE!"
    exit 1
fi

echo "Mounting and copying system files to USB..."
mkdir -p /tmp/cproot
mount $DEVICE /mnt
mount --bind /overlay /tmp/cproot
tar -C /tmp/cproot -cf - . | tar -C /mnt -xf -
umount /tmp/cproot
umount /mnt

echo "Configuring fstab for Extroot..."
UUID=$(block info $DEVICE | grep -o -e "UUID=\S*" | cut -d'=' -f2 | tr -d '"')

if [ -z "$UUID" ]; then
    echo "ERROR: Could not read UUID of $DEVICE!"
    exit 1
fi

uci -q delete fstab.overlay
uci set fstab.overlay="mount"
uci set fstab.overlay.uuid="${UUID}"
uci set fstab.overlay.target="/overlay"
uci set fstab.overlay.enabled="1"
uci commit fstab

echo "SUCCESS! Extroot is configured."
echo "The router will now reboot to apply the extra space..."
sleep 5
reboot
