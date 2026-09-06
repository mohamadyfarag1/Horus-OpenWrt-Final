#!/bin/bash
# =============================================
# Script 4: Inject Cloud App + Passive ARP + Board Extractor
# =============================================
set -e

cd openwrt

# ============================================
# SECTION A: Board Data and Firmware Files
# ============================================
# board-2.bin is the golden calibration blob, shipped via files_ap and copied
# in 05-configure.sh. The files/ overlay is applied after packages, so it wins
# over the package's own board-2.bin - which is what we want.
# firmware-N.bin comes from CONFIG_PACKAGE_ath10k-firmware-qca4019-ct. Do NOT
# hand-edit a "super channel" calibration blob in here again: that is what put
# ath10k into a firmware crash-loop and made Wi-Fi/LAN need several reboots.

# ============================================
# SECTION B: Cloud App - Modern LuCI JS Interface & Daemon
# ============================================
# Clean up any legacy Lua CBI stubs
rm -rf files/usr/lib/lua/luci/controller/cloud.lua files/usr/lib/lua/luci/model/cbi/cloud files/usr/lib/lua/luci/view/cloud

# Copy modern LuCI JS Cloud App files from files_ap
mkdir -p files/usr/share/luci/menu.d
mkdir -p files/usr/share/rpcd/acl.d
mkdir -p files/www/luci-static/resources/view/cloud
mkdir -p files/etc/config
mkdir -p files/etc/init.d
mkdir -p files/usr/bin

cp -f ../files_ap/usr/share/luci/menu.d/luci-app-cloud.json files/usr/share/luci/menu.d/ 2>/dev/null || true
cp -f ../files_ap/usr/share/rpcd/acl.d/luci-app-cloud.json files/usr/share/rpcd/acl.d/ 2>/dev/null || true
cp -f ../files_ap/www/luci-static/resources/view/cloud/settings.js files/www/luci-static/resources/view/cloud/ 2>/dev/null || true
cp -f ../files_ap/etc/config/cloud files/etc/config/ 2>/dev/null || true
cp -f ../files_ap/usr/bin/cloud-daemon.sh files/usr/bin/ 2>/dev/null || true
cp -f ../files_ap/etc/init.d/cloud files/etc/init.d/ 2>/dev/null || true

chmod +x files/usr/bin/cloud-daemon.sh 2>/dev/null || true
chmod +x files/etc/init.d/cloud 2>/dev/null || true

# ============================================
# SECTION C: Passive ARP Sniffer (DEPRECATED & REMOVED)
# Running background tcpdump in promiscuous mode on br-lan caused high CPU
# utilization and unnecessary thermal load on IPQ4019. Standard dnsmasq leases
# and ip neigh are used instead.
# ============================================

# CRITICAL: Strip Windows CRLF line endings
find files/ -type f ! -name '*.bin' ! -name '*.db' -exec sed -i 's/\r$//' {} +
chmod +x files/etc/uci-defaults/*

# ============================================
# SECTION D: Board Data Extractor Tool
# ============================================
mkdir -p files/usr/sbin
cat > files/usr/sbin/extract-board-data << 'EXTRACTEOF'
#!/bin/sh
echo "=== H1Radio Board Data Extractor ==="
ART_MTD=$(grep -i "art\|caldata\|radio\|0:ART" /proc/mtd | head -1 | cut -d: -f1)
if [ -z "$ART_MTD" ]; then
  echo "ERROR: Could not find calibration partition!"
  echo "Available partitions:"
  cat /proc/mtd
  exit 1
fi
echo "Found calibration partition: /dev/$ART_MTD"
dd if=/dev/$ART_MTD of=/tmp/art_backup.bin 2>/dev/null
echo "Calibration data saved to /tmp/art_backup.bin"
echo "Size: $(wc -c < /tmp/art_backup.bin) bytes"
echo ""
echo "To download it to your PC, use:"
echo "  scp root@192.168.1.1:/tmp/art_backup.bin ."
echo ""
echo "=== Done ==="
EXTRACTEOF
chmod +x files/usr/sbin/extract-board-data

echo "✅ Cloud App, Passive ARP, and Board Extractor injected."
