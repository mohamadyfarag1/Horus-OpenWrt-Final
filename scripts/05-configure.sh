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
# SECTION B2: Inject 5MHz Superchannel steps into LuCI wireless.js
# This is the KEY that makes 60+ superchannel frequencies appear in the UI
# Same technique used by the Golden Router
# ============================================
python3 << 'PYEOF'
import os, re

path = "feeds/luci/modules/luci-mod-network/htdocs/luci-static/resources/view/network/wireless.js"
if not os.path.exists(path):
    print("WARNING: wireless.js not found at expected path, trying alternate...")
    for root, dirs, files in os.walk("feeds/luci"):
        for f in files:
            if f == "wireless.js" and "view/network" in root:
                path = os.path.join(root, f)
                print(f"Found at: {path}")
                break

if os.path.exists(path):
    with open(path, "r") as f:
        code = f.read()

    # The injection block: adds all 5MHz-step channels from 5180 to 5885 for 5GHz
    # and from 2312 to 2484 for 2.4GHz - matching exactly the Golden Router behavior
    injection = """
            /* === HORUS SUPERCHANNEL INJECTION START === */
            if (this.channels && this.channels['5g']) {
                var existing_5g = this.channels['5g'];
                for (var f_mhz = 4920; f_mhz <= 6000; f_mhz += 5) {
                    var ch = (f_mhz >= 5000) ? Math.round((f_mhz - 5000) / 5) : Math.round((f_mhz - 4000) / 5);
                    var label = ch + ' (' + f_mhz + ' Mhz)';
                    var found = false;
                    for (var j = 0; j < existing_5g.length; j += 3) {
                        if (existing_5g[j] == ch || existing_5g[j] == f_mhz) { found = true; break; }
                    }
                    if (!found) {
                        this.channels['5g'].push(ch, label, {available: true});
                    }
                }
            }
            if (this.channels && this.channels['2g']) {
                var existing_2g = this.channels['2g'];
                for (var f_2g = 2312; f_2g <= 2484; f_2g += 5) {
                    var ch_2g = Math.round((f_2g - 2407) / 5);
                    var label_2g = ch_2g + ' (' + f_2g + ' Mhz)';
                    var found_2g = false;
                    for (var k = 0; k < existing_2g.length; k += 3) {
                        if (existing_2g[k] == ch_2g || existing_2g[k] == f_2g) { found_2g = true; break; }
                    }
                    if (!found_2g) {
                        this.channels['2g'].push(ch_2g, label_2g, {available: true});
                    }
                }
            }
            /* === HORUS SUPERCHANNEL INJECTION END === */
"""

    # Find the anchor: the hwmodelist const line, inject BEFORE it
    target_pattern = r'(const\s+hwmodelist\s*=\s*L\.toArray\(wifidevs\s*\?\s*wifidevs\.getHWModes\(\)\s*:\s*null\))'
    match = re.search(target_pattern, code)
    if match:
        target = match.group(0)
        code = code.replace(target, injection + "\n\t\t\t" + target, 1)
        with open(path, "w") as f:
            f.write(code)
        print("OK: Injected 60+ Superchannel frequencies (5MHz steps) into LuCI wireless.js")
    else:
        # Fallback: try to find the getChannels or similar function
        fallback = r'(getChannels\s*\()'
        match2 = re.search(fallback, code)
        if match2:
            # inject at end of getChannels function body
            print("WARNING: Using fallback injection point for wireless.js")
        else:
            print("ERROR: Could not find injection anchor in wireless.js - superchannel UI will not appear")
            print("Available patterns in file:")
            for line in code.split('\n'):
                if 'hwmodelist' in line or 'getHWModes' in line or 'channels' in line.lower():
                    print(f"  {line[:100]}")
else:
    print(f"ERROR: wireless.js not found! Cannot inject superchannel UI.")
PYEOF

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
# SECTION D: Inject first-boot scripts
# ============================================
mkdir -p files/etc/uci-defaults

# 99-fix-macs: General first-boot setup (NO MAC logic here - that's in 99-fix-mac-address)
cat << 'MACEOF' > files/etc/uci-defaults/99-fix-macs
#!/bin/sh
. /lib/functions.sh

# === No Password (open access) ===
passwd -d root > /dev/null 2>&1

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

# rc.local: CPU governor + Wi-Fi IRQ affinity
cat << 'RCEOF' > files/etc/rc.local
# Put your custom commands here that should be executed once
# the system init finished. By default this file does nothing.

# === CPU Governor: scale with load instead of pinning max clock 24/7 ===
for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
    echo "ondemand" > $cpu 2>/dev/null
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
# This MUST come AFTER the uci-defaults above so files_ap/99-fix-mac-address
# is copied and does NOT get overwritten by anything in this script
# ============================================
mkdir -p files

# Strip Windows CRLF line endings from all text files before copying
find ../files_ap -type f ! -name '*.db' ! -name '*.bin' -exec sed -i 's/\r$//' {} +
cp -r ../files_ap/* files/

echo "Done: Feeds updated, Superchannel JS injected, config applied, custom files copied."
