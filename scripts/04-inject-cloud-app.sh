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
# SECTION C: Passive ARP Sniffer
# ============================================
mkdir -p files/usr/bin files/etc/init.d files/etc/uci-defaults
cat << 'EOF' > files/usr/bin/passive-ip-helper.sh
#!/bin/sh
mac="$1"
ip="$2"
ip neigh replace "$ip" lladdr "$mac" dev br-lan nud permanent 2>/dev/null
if [ ! -f "/tmp/dhcp-host-$mac" ] && [ ! -f "/tmp/http-host-$mac" ]; then
    title=$(wget -qO- -T 2 "http://$ip/" 2>/dev/null | grep -i '<title>' | sed -n 's/.*<title>\(.*\)<\/title>.*/\1/ip' | head -1 | tr -d '\r\n')
    if [ -n "$title" ]; then
        echo "$title" > "/tmp/http-host-$mac"
    fi
fi
> /tmp/dhcp.leases.new
for f in /tmp/arp-ip-*; do
    [ -f "$f" ] || continue
    m="${f##*-}"
    i=$(cat "$f")
    h="*"
    if [ -f "/tmp/dhcp-host-$m" ]; then
        h=$(cat "/tmp/dhcp-host-$m")
    elif [ -f "/tmp/http-host-$m" ]; then
        h=$(cat "/tmp/http-host-$m")
    fi
    echo "1999999999 $m $i $h *" >> /tmp/dhcp.leases.new
done
mv /tmp/dhcp.leases.new /tmp/dhcp.leases
EOF
chmod +x files/usr/bin/passive-ip-helper.sh

cat << 'EOF' > files/usr/bin/passive-ip-sniffer.sh
#!/bin/sh
LEASES="/tmp/dhcp.leases"
touch "$LEASES"
killall tcpdump 2>/dev/null

# A) Master Sniffer (Captures IP <-> MAC from ARP & ICMP/Ping)
tcpdump -i br-lan -l -n -e -t 'arp or icmp' 2>/dev/null | awk '
{
    mac = tolower($1);
    ip = "";
    if ($4 == "IPv4" || $5 == "IPv4") {
        for(i=1; i<=NF; i++) {
            if ($i ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+(>|:)/ || $(i+1) == ">") {
                ip = $i; sub(/:$/, "", ip); sub(/\.[0-9]+$/, "", ip); break;
            }
        }
    } else {
        for(i=1; i<=NF; i++) {
            if ($i == "tell") { ip = $(i+1); gsub(/,/, "", ip); break; }
            if ($i == "Reply") { ip = $(i+1); break; }
        }
    }
    if (ip ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/ && mac ~ /^[0-9a-f]{2}:/) {
        if (!seen[mac]) {
            seen[mac] = 1
            system("echo " ip " > /tmp/arp-ip-" mac)
            system("/usr/bin/passive-ip-helper.sh " mac " " ip " &")
        }
    }
}
' &

# B) DHCP Sniffer (Captures Hostnames)
tcpdump -i br-lan -l -n -e -v udp port 67 or port 68 2>/dev/null | awk '
/^[0-9a-fA-F]{2}:/ { current_mac = tolower($1) }
/Hostname/ && /"/ {
    s = $0; start = index(s, "\""); end = index(substr(s, start+1), "\"")
    if (start > 0 && end > 0 && current_mac != "") {
        host = substr(s, start+1, end-1)
        system("echo \"" host "\" > /tmp/dhcp-host-" current_mac)
        system("ip=\"$(cat /tmp/arp-ip-" current_mac " 2>/dev/null)\"; [ -n \"$ip\" ] && /usr/bin/passive-ip-helper.sh " current_mac " $ip &")
    }
}
' &

# Wait for background jobs
wait
EOF
chmod +x files/usr/bin/passive-ip-sniffer.sh

cat << 'EOF' > files/etc/init.d/passive-arp
#!/bin/sh /etc/rc.common
START=99
USE_PROCD=1
PROG=/usr/bin/passive-ip-sniffer.sh
start_service() {
    procd_open_instance
    procd_set_param command "$PROG"
    procd_set_param respawn 3600 5 0
    procd_close_instance
}
EOF
chmod +x files/etc/init.d/passive-arp

echo '#!/bin/sh' > files/etc/uci-defaults/99-enable-passive-arp
echo '/etc/init.d/passive-arp enable' >> files/etc/uci-defaults/99-enable-passive-arp
echo 'exit 0' >> files/etc/uci-defaults/99-enable-passive-arp
chmod +x files/etc/uci-defaults/99-enable-passive-arp

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
