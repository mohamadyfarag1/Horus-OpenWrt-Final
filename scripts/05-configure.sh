#!/bin/bash
# =============================================
# Script 5: Update Feeds, Inject LuCI JS, Configure
# =============================================
set -e

cd openwrt

# ============================================
# SECTION A: Update and Install Feeds
# ============================================
./scripts/feeds update -a || true
./scripts/feeds install -a || true

# ============================================
# SECTION B: Inject Custom UI JS for MAC Click-to-Copy and IP Click
# ============================================
cat << 'JSEOF' >> feeds/luci/modules/luci-base/htdocs/luci-static/resources/luci.js
document.addEventListener('DOMContentLoaded', function() {
    setInterval(function() {
        document.querySelectorAll('td, .td').forEach(function(cell) {
            if (cell.dataset.macDone) return;
            var text = cell.innerText || '';
            var macMatch = text.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/);
            if (macMatch) {
                var mac = macMatch[0];
                var span = document.createElement('span');
                span.textContent = mac;
                span.style.cursor = 'pointer';
                span.style.borderBottom = '1px dashed #999';
                span.title = 'Click to copy MAC';
                span.onclick = function() {
                    navigator.clipboard.writeText(mac);
                    span.style.color = '#4caf50';
                    span.style.fontWeight = 'bold';
                    setTimeout(function(){ span.style.color = ''; span.style.fontWeight = ''; }, 1500);
                };
                cell.innerHTML = cell.innerHTML.replace(mac, span.outerHTML);
                cell.dataset.macDone = 'true';
            }
            var ipMatch = text.match(/\b([0-9]{1,3}\.){3}[0-9]{1,3}\b/);
            if (ipMatch && !cell.querySelector('a[href*="http"]')) {
                var ip = ipMatch[0];
                cell.innerHTML = cell.innerHTML.replace(ip, '<a href="http://' + ip + '" target="_blank" style="font-weight:bold; color:#0069d6; text-decoration:underline;">' + ip + '</a>');
            }
        });
    }, 2000);
});
JSEOF

# ============================================
# SECTION C: Write .config from standalone file
# ============================================
cp ../config/horus.config .config
make defconfig

# Remove samba (force)
sed -i '/samba/d' .config
echo "# CONFIG_PACKAGE_luci-app-samba is not set" >> .config
echo "# CONFIG_PACKAGE_luci-app-samba4 is not set" >> .config
echo "# CONFIG_PACKAGE_samba36-server is not set" >> .config
echo "# CONFIG_PACKAGE_samba4-server is not set" >> .config

# ============================================
# SECTION D: Inject MAC Auto-Fix + rc.local
# ============================================
mkdir -p files/etc/uci-defaults
cat << 'MACEOF' > files/etc/uci-defaults/99-fix-macs
#!/bin/sh
# =============================================
# Horus 9200 - First Boot MAC Assignment Only
# =============================================
. /lib/functions.sh

# === MAC Address Assignment ===
BASE_MAC=$(cat /sys/class/net/eth0/address 2>/dev/null)
if [ -n "$BASE_MAC" ]; then
    WAN_MAC=$(macaddr_add "$BASE_MAC" 1)
    WIFI2_MAC=$(macaddr_add "$BASE_MAC" 2)
    WIFI5_MAC=$(macaddr_add "$BASE_MAC" 3)
    uci set network.lan.macaddr="$BASE_MAC"
    uci set network.wan.macaddr="$WAN_MAC"
    uci commit network
    uci set wireless.radio0.macaddr="$WIFI2_MAC"
    uci set wireless.default_radio0.macaddr="$WIFI2_MAC"
    uci set wireless.radio1.macaddr="$WIFI5_MAC"
    uci set wireless.default_radio1.macaddr="$WIFI5_MAC"
    uci commit wireless
fi

# === No Password (open access) ===
passwd -d root >/dev/null 2>&1

# === Fix opkg feeds (http instead of https) ===
sed -i 's/https/http/g' /etc/opkg/distfeeds.conf 2>/dev/null

# === Fix permissions ===
chmod +x /etc/rc.local 2>/dev/null
chmod +x /usr/bin/auto-extroot.sh 2>/dev/null
chmod +x /usr/bin/safe-eject-usb.sh 2>/dev/null
chmod +x /usr/bin/enable-extroot.sh 2>/dev/null

exit 0
MACEOF
chmod +x files/etc/uci-defaults/99-fix-macs

cat << 'RCEOF' > files/etc/rc.local
# Put your custom commands here that should be executed once
# the system init finished. By default this file does nothing.

# === CPU Performance Mode ===
for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
    echo "performance" > $cpu 2>/dev/null
done

# === Wi-Fi SMP Optimization (Pin 2.4G to CPU1, 5G to CPU2) ===
IRQ0=$(grep -m1 -i ath10k /proc/interrupts | awk '{print $1}' | tr -d ':')
IRQ1=$(grep -m2 -i ath10k /proc/interrupts | tail -n1 | awk '{print $1}' | tr -d ':')
[ -n "$IRQ0" ] && echo 2 > /proc/irq/$IRQ0/smp_affinity
[ -n "$IRQ1" ] && echo 4 > /proc/irq/$IRQ1/smp_affinity

exit 0
RCEOF
chmod +x files/etc/rc.local

# ============================================
# SECTION E: Copy Custom Files (files_ap -> openwrt/files)
# ============================================
mkdir -p files

# ============================================
# SECTION E1: Generate Custom Unlocked Regulatory DB
# ============================================
echo "Building custom regulatory.db..."
cd ..
git clone https://git.kernel.org/pub/scm/linux/kernel/git/sforshee/wireless-regdb.git || true
cd wireless-regdb
python3 -c "
countries = [
    '00',
    'AD','AE','AF','AL','AM','AN','AR','AT','AU','AW','AZ',
    'BA','BB','BD','BE','BG','BH','BL','BN','BO','BR','BY',
    'CA','CF','CH','CI','CL','CN','CO','CR','CY','CZ',
    'DE','DK','DO','DZ',
    'EC','EE','EG','ES','ET',
    'FI','FR',
    'GB','GE','GH','GL','GP','GR','GT','GU','GY',
    'HK','HN','HR','HT','HU',
    'ID','IE','IL','IN','IQ','IR','IS','IT',
    'JM','JO','JP',
    'KE','KH','KN','KP','KR','KW','KY','KZ',
    'LB','LC','LI','LK','LS','LT','LU','LV',
    'MA','MC','MD','ME','MF','MH','MK','MN','MO','MP','MQ','MR','MT','MU','MW','MX','MY',
    'NG','NI','NL','NO','NP','NZ',
    'OM',
    'PA','PE','PF','PG','PH','PK','PL','PM','PR','PT','PW','PY',
    'QA',
    'RE','RO','RS','RU','RW',
    'SA','SE','SG','SI','SK','SN','SR','SV','SY',
    'TC','TD','TG','TH','TN','TR','TT','TW','TZ',
    'UA','UG','US','UY','UZ',
    'VC','VE','VI','VN','VU',
    'WF','WS',
    'YE','YT',
    'ZA','ZW'
]
with open('db.txt', 'w') as f:
    for c in countries:
        if c == '00':
            f.write('country 00:\n')
        else:
            f.write(f'country {c}:\n')
        f.write('\t(2192 - 2732 @ 40), (33)\n')
        f.write('\t(4900 - 5350 @ 80), (33)\n')
        f.write('\t(5350 - 5725 @ 80), (33)\n')
        f.write('\t(5725 - 6100 @ 80), (33)\n\n')
"
python3 db2fw.py regulatory.db db.txt || echo "WARNING: db2fw.py failed"
cd ../openwrt

find ../files_ap -type f ! -name '*.db' ! -name '*.bin' -exec sed -i 's/\r$//' {} +
cp -r ../files_ap/* files/

if [ -f ../wireless-regdb/regulatory.db ]; then
  mkdir -p files/lib/firmware
  cp ../wireless-regdb/regulatory.db files/lib/firmware/regulatory.db
  echo "Using freshly built regulatory.db with super channels!"
elif [ -f ../regulatory.db ]; then
  mkdir -p files/lib/firmware
  cp ../regulatory.db files/lib/firmware/regulatory.db
  echo "Using existing regulatory.db from repo (6364 bytes)!"
fi

# ============================================
# Done
# ============================================

echo "Done: Feeds updated, config applied, custom files copied."
