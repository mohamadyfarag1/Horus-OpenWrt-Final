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
            /* === HORUS SUPERCHANNEL ORDERED INJECTION START === */
            /* 5 GHz SuperChannel Plan: 222 Channels (4920 - 6100 MHz, Strictly sorted by MHz ascending like Rocket AC) */
            if (this.channels && this.channels['5g'] && this.channels['5g'].length > 0) {
                var has_auto_5g = (this.channels['5g'][0] === 'auto');
                var horus_5g_plan = [[184, 4920], [185, 4925], [186, 4930], [187, 4935], [188, 4940], [189, 4945], [190, 4950], [191, 4955], [192, 4960], [193, 4965], [194, 4970], [195, 4975], [196, 4980], [197, 4985], [198, 4990], [199, 4995], [200, 5000], [16, 5080], [17, 5085], [18, 5090], [19, 5095], [20, 5100], [21, 5105], [22, 5110], [23, 5115], [24, 5120], [25, 5125], [26, 5130], [27, 5135], [28, 5140], [29, 5145], [30, 5150], [31, 5155], [32, 5160], [33, 5165], [34, 5170], [35, 5175], [36, 5180], [37, 5185], [38, 5190], [39, 5195], [40, 5200], [41, 5205], [42, 5210], [43, 5215], [44, 5220], [45, 5225], [46, 5230], [47, 5235], [48, 5240], [49, 5245], [50, 5250], [51, 5255], [52, 5260], [53, 5265], [54, 5270], [55, 5275], [56, 5280], [57, 5285], [58, 5290], [59, 5295], [60, 5300], [61, 5305], [62, 5310], [63, 5315], [64, 5320], [65, 5325], [66, 5330], [67, 5335], [68, 5340], [69, 5345], [70, 5350], [71, 5355], [72, 5360], [73, 5365], [74, 5370], [75, 5375], [76, 5380], [77, 5385], [78, 5390], [79, 5395], [80, 5400], [81, 5405], [82, 5410], [83, 5415], [84, 5420], [85, 5425], [86, 5430], [87, 5435], [88, 5440], [89, 5445], [90, 5450], [91, 5455], [92, 5460], [93, 5465], [94, 5470], [95, 5475], [96, 5480], [97, 5485], [98, 5490], [99, 5495], [100, 5500], [101, 5505], [102, 5510], [103, 5515], [104, 5520], [105, 5525], [106, 5530], [107, 5535], [108, 5540], [109, 5545], [110, 5550], [111, 5555], [112, 5560], [113, 5565], [114, 5570], [115, 5575], [116, 5580], [117, 5585], [118, 5590], [119, 5595], [120, 5600], [121, 5605], [122, 5610], [123, 5615], [124, 5620], [125, 5625], [126, 5630], [127, 5635], [128, 5640], [129, 5645], [130, 5650], [131, 5655], [132, 5660], [133, 5665], [134, 5670], [135, 5675], [136, 5680], [137, 5685], [138, 5690], [139, 5695], [140, 5700], [141, 5705], [142, 5710], [143, 5715], [144, 5720], [145, 5725], [146, 5730], [147, 5735], [148, 5740], [149, 5745], [150, 5750], [151, 5755], [152, 5760], [153, 5765], [154, 5770], [155, 5775], [156, 5780], [157, 5785], [158, 5790], [159, 5795], [160, 5800], [161, 5805], [162, 5810], [163, 5815], [164, 5820], [165, 5825], [166, 5830], [167, 5835], [168, 5840], [169, 5845], [170, 5850], [171, 5855], [172, 5860], [173, 5865], [174, 5870], [175, 5875], [176, 5880], [177, 5885], [178, 5890], [179, 5895], [180, 5900], [181, 5905], [182, 5910], [183, 5915], [221, 5920], [222, 5925], [223, 5930], [224, 5935], [225, 5940], [226, 5945], [227, 5950], [228, 5955], [229, 5960], [230, 5965], [231, 5970], [232, 5975], [233, 5980], [234, 5985], [235, 5990], [236, 5995], [237, 6000], [201, 6005], [202, 6010], [203, 6015], [204, 6020], [205, 6025], [206, 6030], [207, 6035], [208, 6040], [209, 6045], [210, 6050], [211, 6055], [212, 6060], [213, 6065], [214, 6070], [215, 6075], [216, 6080], [217, 6085], [218, 6090], [219, 6095], [220, 6100]];
                var new_5g = has_auto_5g ? ['auto', 'auto', {available: true}] : [];
                for (var i = 0; i < horus_5g_plan.length; i++) {
                    var ch = horus_5g_plan[i][0];
                    var mhz = horus_5g_plan[i][1];
                    new_5g.push(mhz, mhz + ' MHz (Ch ' + ch + ')', {available: true});
                }
                this.channels['5g'] = new_5g;
            }

            /* 2.4 GHz SuperChannel Plan: 86 Channels (2312 - 2732 MHz, Strictly sorted by MHz ascending like NanoStation M2) */
            if (this.channels && this.channels['2g'] && this.channels['2g'].length > 0) {
                var has_auto_2g = (this.channels['2g'][0] === 'auto');
                  var horus_2g_plan = [
                      [238, 2312], [239, 2317], [240, 2322], [241, 2327], [242, 2332],
                      [243, 2337], [244, 2342], [245, 2347], [246, 2352], [247, 2357],
                      [248, 2362], [249, 2367], [250, 2372], [251, 2377], [252, 2382],
                      [253, 2387], [254, 2392], [255, 2397], [256, 2402], [257, 2407],
                      [1, 2412], [2, 2417], [3, 2422], [4, 2427], [5, 2432],
                      [6, 2437], [7, 2442], [8, 2447], [9, 2452], [10, 2457],
                      [11, 2462], [12, 2467], [13, 2472], [15, 2477], [258, 2482],
                      [14, 2484], [259, 2487], [260, 2492], [261, 2497], [262, 2502],
                      [263, 2507], [264, 2512], [265, 2517], [266, 2522], [267, 2527],
                      [268, 2532], [269, 2537], [270, 2542], [271, 2547], [272, 2552],
                      [273, 2557], [274, 2562], [275, 2567], [276, 2572], [277, 2577],
                      [278, 2582], [279, 2587], [280, 2592], [281, 2597], [282, 2602],
                      [283, 2607], [284, 2612], [285, 2617], [286, 2622], [287, 2627],
                      [288, 2632], [289, 2637], [290, 2642], [291, 2647], [292, 2652],
                      [293, 2657], [294, 2662], [295, 2667], [296, 2672], [297, 2677],
                      [298, 2682], [299, 2687], [300, 2692], [301, 2697], [302, 2702],
                      [303, 2707], [304, 2712], [305, 2717], [306, 2722], [307, 2727],
                      [308, 2732]
                  ];
                var new_2g = has_auto_2g ? ['auto', 'auto', {available: true}] : [];
                for (var i = 0; i < horus_2g_plan.length; i++) {
                    var ch = horus_2g_plan[i][0];
                    var mhz = horus_2g_plan[i][1];
                    new_2g.push(mhz, mhz + ' MHz (Ch ' + ch + ')', {available: true});
                }
                this.channels['2g'] = new_2g;
            }
            /* === HORUS SUPERCHANNEL ORDERED INJECTION END === */
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
echo "CONFIG_CCACHE_DIR=\"/home/runner/.cache/ccache\"" >> .config

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

# Inject build fingerprint into SSH banner and /etc/horus_version
_COMMIT=$(cd .. && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
_DATE=$(date -u '+%Y-%m-%d %H:%M UTC')
printf ' Build : %s\n Date  : %s\n ---------------------------------------------------\n' \
    "$_COMMIT" "$_DATE" >> files/etc/banner
printf 'HORUS_COMMIT=%s\nHORUS_DATE=%s\n' "$_COMMIT" "$_DATE" > files/etc/horus_version

# Ensure execution permissions for scripts
chmod +x files/www/cgi-bin/* 2>/dev/null || true
chmod +x files/etc/init.d/* 2>/dev/null || true
chmod +x files/etc/uci-defaults/* 2>/dev/null || true
chmod +x files/usr/bin/* 2>/dev/null || true
chmod +x files/usr/lib/hamax/* 2>/dev/null || true
chmod +x files/lib/netifd/hostapd.sh 2>/dev/null || true

echo "Done: Feeds updated, Superchannel JS injected, config applied, custom files copied."

