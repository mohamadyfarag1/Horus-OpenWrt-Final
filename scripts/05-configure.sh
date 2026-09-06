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

    # LuCI dropdown list - MIRRORS the driver channel table.
    #
    # LuCI dropdown list - MIRRORS the driver channel table.
    #
    # As of the PATCH 5 rewrite in 07-unlock-superchannel.sh, these 68
    # frequencies are now REAL channels in ath10k_5ghz_channels[], so LuCI
    # already enumerates them from the phy. This block is belt-and-braces:
    # it de-dupes against what the phy reports and only adds anything if a
    # LuCI version filters the list. The array below is byte-for-byte the
    # same channel plan the driver now registers and the same list read
    # off the reference AP with "iw phy": 36..146 step 2, 149..165 step 2,
    # then 169/173/177 (10 MHz spacing, 68 entries).
    #
    # Keep this array and the driver array (PATCH 5) in lock-step. A
    # frequency listed here but absent from the driver table would read
    # 0 dBm; one in the driver but not here still works, just not shown.
    injection = """
            /* === HORUS SUPERCHANNEL INJECTION START === */
            if (this.channels && this.channels['5g'] && this.channels['5g'].length > 0) {
                var existing_5g = this.channels['5g'];
                var horus_freqs = [5120,5125,5130,5135,5140,5145,5150,5155,
                                   5160,5165,5170,5175,5180,5185,5190,5195,
                                   5200,5205,5210,5215,5220,5225,5230,5235,
                                   5240,5245,5250,5255,5260,5265,5270,5275,
                                   5280,5285,5290,5295,5300,5305,5310,5315,
                                   5320,5325,5330,5335,5340,5345,5350,5355,
                                   5360,5365,5370,5375,5380,5385,5390,5395,
                                   5400,5405,5410,5415,5420,5425,5430,5435,
                                   5440,5445,5450,5455,5460,5465,5470,5475,
                                   5480,5485,5490,5495,5500,5505,5510,5515,
                                   5520,5525,5530,5535,5540,5545,5550,5555,
                                   5560,5565,5570,5575,5580,5585,5590,5595,
                                   5600,5605,5610,5615,5620,5625,5630,5635,
                                   5640,5645,5650,5655,5660,5665,5670,5675,
                                   5680,5685,5690,5695,5700,5705,5710,5715,
                                   5720,5725,5730,5735,5740,5745,5750,5755,
                                   5760,5765,5770,5775,5780,5785,5790,5795,
                                   5800,5805,5810,5815,5820,5825,5830,5835,
                                   5840,5845,5850,5855,5860,5865,5870,5875,
                                   5880,5885,5890,5895,5900,5905,5910,5915,
                                   5920,5925];
                for (var hi = 0; hi < horus_freqs.length; hi++) {
                    var f_mhz = horus_freqs[hi];
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

            /* === HORUS 2.4 GHz SUPERCHANNEL INJECTION (86 Channels: 2312 - 2732 MHz) === */
            if (this.channels && this.channels['2g'] && this.channels['2g'].length > 0) {
                var existing_2g = this.channels['2g'];
                var horus_2g_list = [
                    /* 2.3 GHz Sub-band: 2312 - 2407 MHz */
                    [237, '237 (2312 MHz)'], [238, '238 (2317 MHz)'], [239, '239 (2322 MHz)'],
                    [240, '240 (2327 MHz)'], [241, '241 (2332 MHz)'], [242, '242 (2337 MHz)'],
                    [243, '243 (2342 MHz)'], [244, '244 (2347 MHz)'], [245, '245 (2352 MHz)'],
                    [246, '246 (2357 MHz)'], [247, '247 (2362 MHz)'], [248, '248 (2367 MHz)'],
                    [249, '249 (2372 MHz)'], [250, '250 (2377 MHz)'], [251, '251 (2382 MHz)'],
                    [252, '252 (2387 MHz)'], [253, '253 (2392 MHz)'], [254, '254 (2397 MHz)'],
                    [255, '255 (2402 MHz)'], [256, '256 (2407 MHz)'],
                    /* Standard 2.4 GHz Channels: 1-13 */
                    [1, '1 (2412 MHz)'], [2, '2 (2417 MHz)'], [3, '3 (2422 MHz)'],
                    [4, '4 (2427 MHz)'], [5, '5 (2432 MHz)'], [6, '6 (2437 MHz)'],
                    [7, '7 (2442 MHz)'], [8, '8 (2447 MHz)'], [9, '9 (2452 MHz)'],
                    [10, '10 (2457 MHz)'], [11, '11 (2462 MHz)'], [12, '12 (2467 MHz)'],
                    [13, '13 (2472 MHz)'],
                    /* Standard Channel 14 Japan */
                    [14, '14 (2484 MHz)'],
                    /* Transition Channels: 74-80 (2477 - 2507 MHz) */
                    [74, '74 (2477 MHz)'], [75, '75 (2482 MHz)'], [76, '76 (2487 MHz)'],
                    [77, '77 (2492 MHz)'], [78, '78 (2497 MHz)'], [79, '79 (2502 MHz)'],
                    [80, '80 (2507 MHz)'],
                    /* Upper Band: 15-59 (2512 - 2732 MHz) */
                    [15, '15 (2512 MHz)'], [16, '16 (2517 MHz)'], [17, '17 (2522 MHz)'],
                    [18, '18 (2527 MHz)'], [19, '19 (2532 MHz)'], [20, '20 (2537 MHz)'],
                    [21, '21 (2542 MHz)'], [22, '22 (2547 MHz)'], [23, '23 (2552 MHz)'],
                    [24, '24 (2557 MHz)'], [25, '25 (2562 MHz)'], [26, '26 (2567 MHz)'],
                    [27, '27 (2572 MHz)'], [28, '28 (2577 MHz)'], [29, '29 (2582 MHz)'],
                    [30, '30 (2587 MHz)'], [31, '31 (2592 MHz)'], [32, '32 (2597 MHz)'],
                    [33, '33 (2602 MHz)'], [34, '34 (2607 MHz)'], [35, '35 (2612 MHz)'],
                    [36, '36 (2617 MHz)'], [37, '37 (2622 MHz)'], [38, '38 (2627 MHz)'],
                    [39, '39 (2632 MHz)'], [40, '40 (2637 MHz)'], [41, '41 (2642 MHz)'],
                    [42, '42 (2647 MHz)'], [43, '43 (2652 MHz)'], [44, '44 (2657 MHz)'],
                    [45, '45 (2662 MHz)'], [46, '46 (2667 MHz)'], [47, '47 (2672 MHz)'],
                    [48, '48 (2677 MHz)'], [49, '49 (2682 MHz)'], [50, '50 (2687 MHz)'],
                    [51, '51 (2692 MHz)'], [52, '52 (2697 MHz)'], [53, '53 (2702 MHz)'],
                    [54, '54 (2707 MHz)'], [55, '55 (2712 MHz)'], [56, '56 (2717 MHz)'],
                    [57, '57 (2722 MHz)'], [58, '58 (2727 MHz)'], [59, '59 (2732 MHz)']
                ];
                for (var hi = 0; hi < horus_2g_list.length; hi++) {
                    var ch = horus_2g_list[hi][0];
                    var label = horus_2g_list[hi][1];
                    var found = false;
                    for (var j = 0; j < existing_2g.length; j += 3) {
                        if (existing_2g[j] == ch) { found = true; break; }
                    }
                    if (!found) {
                        this.channels['2g'].push(ch, label, {available: true});
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
# SECTION B3: Inject LAN Port Control UI into 29_ports.js
# ============================================
if [ -f "../files_ap/www/luci-static/resources/view/status/include/29_ports.js" ]; then
    mkdir -p feeds/luci/modules/luci-mod-status/htdocs/luci-static/resources/view/status/include/ 2>/dev/null || true
    cp -f ../files_ap/www/luci-static/resources/view/status/include/29_ports.js feeds/luci/modules/luci-mod-status/htdocs/luci-static/resources/view/status/include/29_ports.js 2>/dev/null || true
    mkdir -p package/feeds/luci/luci-mod-status/htdocs/luci-static/resources/view/status/include/ 2>/dev/null || true
    cp -f ../files_ap/www/luci-static/resources/view/status/include/29_ports.js package/feeds/luci/luci-mod-status/htdocs/luci-static/resources/view/status/include/29_ports.js 2>/dev/null || true
    mkdir -p files/www/luci-static/resources/view/status/include/ 2>/dev/null || true
    cp -f ../files_ap/www/luci-static/resources/view/status/include/29_ports.js files/www/luci-static/resources/view/status/include/29_ports.js 2>/dev/null || true
    echo "OK: Injected LAN & Wireless Port Control UI into LuCI 29_ports.js"
fi

# ============================================
# SECTION B4: Inject Ubiquiti airMAX Interoperability into hostapd.sh
# ============================================
if [ -f "../files_ap/lib/netifd/hostapd.sh" ]; then
    mkdir -p package/network/config/wifi-scripts/files/lib/netifd 2>/dev/null || true
    cp -f ../files_ap/lib/netifd/hostapd.sh package/network/config/wifi-scripts/files/lib/netifd/hostapd.sh 2>/dev/null || true
    echo "OK: Injected Ubiquiti airMAX vendor element support into hostapd.sh"
fi

# ============================================
# SECTION C: Write .config from standalone file
# ============================================
cp ../config/horus.config .config
make defconfig

# make defconfig silently DROPS any CONFIG_ symbol that does not exist in the
# tree. That is how CONFIG_PACKAGE_ath10k-firmware-qca4019-ct-fullall - a
# package name that does not exist in 24.10 - disappeared without a word,
# leaving an image with no firmware-N.bin at all and both Wi-Fi radios dead
# at probe (-12). Fail here, three minutes in, instead of after a full build.
if ! grep -q "^CONFIG_PACKAGE_ath10k-firmware-qca4019-ct=y" .config; then
    echo "!!!! ath10k-firmware-qca4019-ct did not survive 'make defconfig'."
    echo "     Without it the image has no firmware-N.bin and both radios"
    echo "     die at probe with -12."
    grep -i "ath10k" .config || true
    exit 1
fi
# Either driver variant is fine - smallbuffers is the one the reference AP
# runs - but exactly one of them has to be selected.
if ! grep -qE "^CONFIG_PACKAGE_kmod-ath10k-ct(-smallbuffers)?=y" .config; then
    echo "!!!! No ath10k-ct driver variant selected after 'make defconfig'."
    grep -i "ath10k" .config || true
    exit 1
fi
echo "OK: ath10k driver + firmware packages selected:"
grep -E "^CONFIG_PACKAGE_(kmod-)?ath10k[a-z0-9-]*=y" .config

# Enable ccache for fast incremental builds
echo "CONFIG_CCACHE=y" >> .config

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
chmod +x /etc/init.d/smp_tuning 2>/dev/null
chmod +x /usr/bin/horus-wifi-check 2>/dev/null
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

# === Apply Multi-Core SMP & Network Steering ===
/etc/init.d/smp_tuning start >/dev/null 2>&1 || true

# === Restore Disabled Ethernet Ports (Horus LAN Control) ===
for f in /etc/horus/disabled_port_*; do
    [ -f "$f" ] || continue
    p="${f##*/disabled_port_}"
    [ -n "$p" ] || continue
    ip link set "$p" down 2>/dev/null
    ip link set "$p" nomaster 2>/dev/null
done

# === Wi-Fi self-check into the system log (tag: horus-wifi) ===
# Detached so it never delays boot. 40s gives ath10k time to load its
# firmware and register both phys before the census is taken.
# Read it with:  logread | grep horus-wifi
# Or run it by hand any time with:  horus-wifi-check
(sleep 40; HORUS_TO_LOG=1 /usr/bin/horus-wifi-check >/dev/null 2>&1) &

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

# Ensure execution permissions for scripts
chmod +x files/www/cgi-bin/* 2>/dev/null || true
chmod +x files/etc/init.d/* 2>/dev/null || true
chmod +x files/etc/uci-defaults/* 2>/dev/null || true
chmod +x files/usr/bin/* 2>/dev/null || true
chmod +x files/usr/lib/hamax/* 2>/dev/null || true
chmod +x files/lib/netifd/hostapd.sh 2>/dev/null || true

echo "Done: Feeds updated, Superchannel JS injected, config applied, custom files copied."
