# 💾 USB Storage Expansion (Extroot), Memory Optimization, and Running Ubuntu / Docker Containers

## 1. Extroot Architecture for IPQ4019
The internal NAND flash is 128MB. To install packages, run Docker containers, or host entire Linux distributions, the root filesystem `/` is extended onto a USB 3.0 flash drive via **Extroot**:

```
+-------------------------------------------------------------------+
| Router Boot Sequence with Extroot:                                |
| 1. U-Boot loads Kernel + DTB from NAND (/dev/mtd8).               |
| 2. Kernel mounts read-only SquashFS root.                         |
| 3. /lib/preinit/80_mount_root detects external ext4 partition on  |
|    USB (/dev/sda1) matching /etc/config/fstab overlay target.     |
| 4. System pivots root (pivot_root) into /dev/sda1.               |
| 5. Router's / is now 16GB / 32GB / 64GB with full write speed!    |
+-------------------------------------------------------------------+
```

---

## 2. Automated Extroot Script (`/usr/bin/auto-extroot.sh`)
```bash
#!/bin/sh
set -e

# Detect first USB drive
DEV=$(ls /dev/sd[a-z] 2>/dev/null | head -1)
if [ -z "$DEV" ]; then
    echo "ERROR: No USB drive detected!"
    exit 1
fi

echo "Formatting $DEV with ext4 partition table..."
parted -s "$DEV" mklabel msdos
parted -s "$DEV" mkpart primary ext4 1MiB 100%
mkfs.ext4 -F "${DEV}1"

# Copy current overlay data to USB
mkdir -p /tmp/usb_mount
mount "${DEV}1" /tmp/usb_mount
tar -C /overlay -cvf - . | tar -C /tmp/usb_mount -xvf -
sync
umount /tmp/usb_mount

# Configure fstab
uci set fstab.@mount[0].target='/overlay'
uci set fstab.@mount[0].device="${DEV}1"
uci set fstab.@mount[0].fstype='ext4'
uci set fstab.@mount[0].enabled='1'
uci commit fstab

echo "Extroot configured successfully! Rebooting in 3 seconds..."
sleep 3
reboot
```

---

## 3. Running Ubuntu / Debian natively via Chroot (Zero-Overhead)

Because the IPQ4019 is a 32-bit ARMv7 (`armhf`) processor, you can download a minimal Ubuntu 22.04 LTS rootfs directly onto the USB drive and enter a full Ubuntu shell without running a heavy virtualization or container daemon.

### Step-by-Step Deployment:
```bash
# 1. Create Ubuntu container directory on USB
mkdir -p /opt/ubuntu
cd /opt/ubuntu

# 2. Download Ubuntu Base 22.04 LTS (ARMhf / ARMv7)
wget http://cdimage.ubuntu.com/ubuntu-base/releases/22.04/release/ubuntu-base-22.04.4-base-armhf.tar.gz

# 3. Extract the rootfs
tar -xzvf ubuntu-base-22.04.4-base-armhf.tar.gz
rm ubuntu-base-22.04.4-base-armhf.tar.gz

# 4. Copy DNS resolution config
cp /etc/resolv.conf /opt/ubuntu/etc/

# 5. Mount virtual filesystems
mount -t proc /proc /opt/ubuntu/proc
mount -o bind /dev /opt/ubuntu/dev
mount -o bind /dev/pts /opt/ubuntu/dev/pts
mount -t sysfs /sys /opt/ubuntu/sys

# 6. Enter the Ubuntu environment
chroot /opt/ubuntu /bin/bash
```

Inside the chroot:
```bash
# You are now running genuine Ubuntu 22.04 LTS on the router!
apt update
apt install -y curl wget python3 python3-pip htop nano

# Start your Python web apps, bots, or microservices natively!
```

---

## 4. Running Docker & Containers (`dockerd` + `luci-app-dockerman`)

Once Extroot is active:
```bash
opkg update
opkg install dockerd docker docker-compose luci-app-dockerman

# Enable and start Docker service
/etc/init.d/dockerd enable
/etc/init.d/dockerd start
```

### Recommended Lightweight Docker Containers for 256MB RAM:
- **Pi-hole / AdGuard Home**: Network-wide ad blocking.
- **Nginx / Caddy**: Lightweight reverse proxy.
- **Alpine Linux Microservices**: Custom Python/Go background workers.
