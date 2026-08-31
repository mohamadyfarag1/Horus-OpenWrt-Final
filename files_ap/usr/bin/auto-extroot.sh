#!/bin/sh
# Auto-Extroot Script - Fixed Version

echo "Starting Auto-Extroot setup..."
DEVICE="/dev/sda"

if [ ! -b "$DEVICE" ]; then
    echo "ERROR: No USB drive detected at $DEVICE!"
    exit 1
fi

echo "WARNING: This will completely erase the USB drive at $DEVICE."
# 1. Create a fresh partition table and one ext4 partition
printf "o\nn\np\n1\n\n\nw\n" | fdisk "$DEVICE" >/dev/null 2>&1
sleep 2
PARTITION="${DEVICE}1"

if [ ! -b "$PARTITION" ]; then
    echo "ERROR: Failed to create partition $PARTITION!"
    exit 1
fi

echo "Unmounting any existing partitions to prevent locks..."
umount ${DEVICE}* 2>/dev/null || true
swapoff ${DEVICE}* 2>/dev/null || true
sleep 1

echo "Formatting $PARTITION to ext4..."
mkfs.ext4 -F "$PARTITION"

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to format $PARTITION!"
    exit 1
fi

echo "Mounting and copying system files to USB..."
mount "$PARTITION" /mnt
# Copy ALL overlay data correctly so config isn't lost
tar -C /overlay -cf - . | tar -C /mnt -xf -
umount /mnt

echo "Configuring fstab for Extroot..."
# Get UUID of the PARTITION, not the raw device
UUID=$(block info "$PARTITION" | grep -o -e "UUID=\S*" | cut -d'=' -f2 | tr -d '"')

if [ -z "$UUID" ]; then
    echo "ERROR: Could not read UUID of $PARTITION!"
    exit 1
fi

# Configure fstab
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

