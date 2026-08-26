#!/bin/bash
# =============================================
# Script 4: Inject Cloud App + Passive ARP + Board Extractor
# =============================================
set -e

cd openwrt

# ============================================
# SECTION A: Board Data and Firmware Files
# ============================================
mkdir -p files/lib/firmware/ath10k/QCA4019/hw1.0/
cp ../board-2.bin files/lib/firmware/ath10k/QCA4019/hw1.0/board-2.bin
# NOTE: files_ap is copied in 05-configure.sh with proper binary file protection

# ============================================
# SECTION B: Cloud App - LuCI Interface
# ============================================
mkdir -p files/usr/lib/lua/luci/controller
mkdir -p files/usr/lib/lua/luci/model/cbi/cloud
mkdir -p files/usr/lib/lua/luci/view/cloud
mkdir -p files/etc/config
mkdir -p files/etc/init.d
mkdir -p files/usr/bin

mkdir -p files/usr/share/rpcd/acl.d
cat << 'EOF' > files/usr/share/rpcd/acl.d/luci-app-cloud.json
{
    "luci-app-cloud": {
        "description": "Grant access for Cloud app",
        "read": {
            "uci": [ "cloud" ],
            "file": [ "/tmp/cloud.status", "/tmp/cloud.url" ]
        },
        "write": {
            "uci": [ "cloud" ],
            "file": [ "/tmp/cloud.status", "/tmp/cloud.url" ]
        }
    }
}
EOF
cat << 'EOF' > files/usr/lib/lua/luci/controller/cloud.lua
module("luci.controller.cloud", package.seeall)
function index()
    entry({"admin", "services", "cloud"}, cbi("cloud/settings"), _("Cloud Access"), 60)
    entry({"admin", "services", "cloud", "status"}, call("action_status"))
end
function action_status()
    local fs = require "nixio.fs"
    local status = fs.readfile("/tmp/cloud.status") or "\xf0\x9f\x94\xb4 Offline"
    local url = fs.readfile("/tmp/cloud.url") or ""
    luci.http.prepare_content("application/json")
    luci.http.write_json({status = status, url = url})
end
EOF

# 2. Model (Creates the Enable checkbox and Status page)
cat << 'EOF' > files/usr/lib/lua/luci/model/cbi/cloud/settings.lua
m = Map("cloud", translate("Cloud Access"), translate("Enable secure remote access to this router via Cloudflare Tunnel."))
s = m:section(TypedSection, "settings", translate("General Settings"))
s.anonymous = true

e = s:option(Flag, "enabled", translate("Enable Cloud Access"))
e.rmempty = false

token = s:option(Value, "cf_token", translate("API Token"))
token.password = true
token:depends("enabled", "1")

status = s:option(DummyValue, "_status", translate("Status"))
status.template = "cloud/status"

d = m:section(TypedSection, "device", translate("Forwarded Devices (Optional)"), translate("Add internal devices (like DVR, Camera) to access them remotely via Cloudflare Tunnel."))
d.template = "cbi/tblsection"
d.addremove = true
d.anonymous = true

name = d:option(Value, "name", translate("Subdomain"), translate("e.g. dvr1"))
name.rmempty = false
name.datatype = "hostname"

proto = d:option(ListValue, "proto", translate("Protocol"))
proto:value("http", "HTTP")
proto:value("https", "HTTPS")
proto:value("tcp", "TCP")
proto:value("ssh", "SSH")
proto.default = "http"

ip = d:option(Value, "ip", translate("Internal IP[:Port]"), translate("e.g. 192.168.1.10 (Port is optional)"))
ip.rmempty = false

url = d:option(DummyValue, "_url", translate("Access Link"))
url.rawhtml = true
function url.cfgvalue(self, section)
    local n = m.uci:get("cloud", section, "name")
    if n and n ~= "" then
        local link = "https://" .. n .. ".opsegypt.com"
        return '<a href="' .. link .. '" target="_blank" style="color:#0055ff; text-decoration:underline;">' .. link .. '</a>'
    end
    return '<span style="color:#999;">Save first</span>'
end

return m
EOF

# 3. View (AJAX script to update status without refreshing)
cat << 'EOF' > files/usr/lib/lua/luci/view/cloud/status.htm
<div id="cloud-status-container">
    <span id="cloud-status" style="font-weight:bold; padding:5px 10px; border-radius:3px;">Checking status...</span>
    <div id="cloud-url" style="margin-top:10px; font-size:16px;"></div>
</div>
<script type="text/javascript">
    setInterval(function() {
        XHR.get('<%=luci.dispatcher.build_url("admin", "services", "cloud", "status")%>', null, function(x, data) {
            if (data && data.status) {
                var el = document.getElementById('cloud-status');
                el.innerHTML = data.status;
                if (data.status.indexOf('Online') !== -1) {
                    el.style.backgroundColor = '#dff0d8'; el.style.color = '#3c763d';
                } else if (data.status.indexOf('Offline') !== -1 || data.status.indexOf('Error') !== -1) {
                    el.style.backgroundColor = '#f2dede'; el.style.color = '#a94442';
                } else {
                    el.style.backgroundColor = '#fcf8e3'; el.style.color = '#8a6d3b';
                }
                var urlEl = document.getElementById('cloud-url');
                if (data.url && data.url !== '') {
                    urlEl.innerHTML = '<b>Access URL:</b> <a href="' + data.url + '" target="_blank" style="color:#0055ff;">' + data.url + '</a>';
                } else {
                    urlEl.innerHTML = '';
                }
            }
        });
    }, 2000);
</script>
EOF

# 4. Default Config
cat << 'EOF' > files/etc/config/cloud
config settings 'main'
    option enabled '0'
    option cf_domain 'opsegypt.com'
    option cf_account 'd23adb9c36dbe134bc1ce01f74db07fa'
    option cf_zone 'cc802f55a41b79336afc874b43c19c47'
    option cf_token ''
EOF

# 5. Daemon Script (Does the heavy lifting)
cat << 'CLOUDEOF' > files/usr/bin/cloud-daemon.sh
#!/bin/sh

# ========================================================
# CLOUDFLARE API CREDENTIALS
# ========================================================
CF_DOMAIN="opsegypt.com"
CF_ACCOUNT="d23adb9c36dbe134bc1ce01f74db07fa"
CF_ZONE="cc802f55a41b79336afc874b43c19c47"
CF_TOKEN=$(uci -q get cloud.@settings[0].cf_token)
# ========================================================

STATUS_FILE="/tmp/cloud.status"
URL_FILE="/tmp/cloud.url"

# Validate if token is provided
if [ -z "$CF_TOKEN" ]; then
    echo "\xf0\x9f\x94\xb4 Error: API Failed - Token is missing!" > "$STATUS_FILE"
    exit 1
fi

echo "\xf0\x9f\x9f\xa1 Checking space..." > "$STATUS_FILE"

FREE_KB=$(df -k / | awk 'NR==2 {print $4}')
if [ "$FREE_KB" -lt 20000 ]; then
    echo "\xf0\x9f\x94\xb4 Error: Not enough space (Need 20MB)! Please format USB first." > "$STATUS_FILE"
    exit 1
fi

# Check internet connectivity
if ! ping -c 1 -W 3 1.1.1.1 >/dev/null 2>&1; then
    echo "\xf0\x9f\x94\xb4 Error: No Internet! Connect WAN cable first." > "$STATUS_FILE"
    exit 1
fi

if ! command -v cloudflared >/dev/null 2>&1; then
    echo "\xf0\x9f\x9f\xa1 Installing cloudflared (Takes 1-2 minutes)..." > "$STATUS_FILE"
    opkg update >/dev/null 2>&1
    opkg install cloudflared >/dev/null 2>&1
    if ! command -v cloudflared >/dev/null 2>&1; then
        echo "\xf0\x9f\x94\xb4 Error: Installation failed! Check internet." > "$STATUS_FILE"
        exit 1
    fi
fi

echo "\xf0\x9f\x9f\xa1 Connecting to Cloudflare API..." > "$STATUS_FILE"
> "$URL_FILE"

# Get MAC address for unique naming
MAC=$(cat /sys/class/net/eth0/address | sed 's/://g')
TUNNEL_NAME="Horus-${MAC}"
FQDN="${MAC}.${CF_DOMAIN}"

# Check for existing tunnels with the same name
OLD_TUNNELS=$(curl -s -X GET \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/cfd_tunnel?name=${TUNNEL_NAME}&is_deleted=false" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json")
TUNNEL_ID=$(echo "$OLD_TUNNELS" | jsonfilter -e '@.result[0].id' 2>/dev/null)

if [ -n "$TUNNEL_ID" ]; then
    echo "\xf0\x9f\x9f\xa1 Found existing tunnel. Reconnecting..." > "$STATUS_FILE"
else
    echo "\xf0\x9f\x9f\xa1 Creating new Tunnel..." > "$STATUS_FILE"
    RES=$(curl -s -X POST \
      "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/cfd_tunnel" \
      -H "Authorization: Bearer ${CF_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "{\"name\":\"${TUNNEL_NAME}\", \"config_src\":\"cloudflare\"}")
    TUNNEL_ID=$(echo "$RES" | jsonfilter -e '@.result.id' 2>/dev/null)
    
    if [ -z "$TUNNEL_ID" ]; then
        ERROR_MSG=$(echo "$RES" | jsonfilter -e '@.errors[0].message' 2>/dev/null)
        echo "\xf0\x9f\x94\xb4 Error: API Failed - ${ERROR_MSG:-Unknown}" > "$STATUS_FILE"
        exit 1
    fi
fi

# Retrieve the auth token for the tunnel
TOKEN_RES=$(curl -s -X GET \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/cfd_tunnel/${TUNNEL_ID}/token" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json")
TUNNEL_TOKEN=$(echo "$TOKEN_RES" | jsonfilter -e '@.result' 2>/dev/null)

# Ingress Array (Start with the main router)
INGRESS="[{\"hostname\":\"${FQDN}\",\"service\":\"http://127.0.0.1:80\"}"

# Add Main DNS
echo "\xf0\x9f\x9f\xa1 Setting up DNS for Router..." > "$STATUS_FILE"
DNS_RES=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records?name=${FQDN}" -H "Authorization: Bearer ${CF_TOKEN}")
DNS_ID=$(echo "$DNS_RES" | jsonfilter -e '@.result[0].id' 2>/dev/null)
if [ -n "$DNS_ID" ]; then
    curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records/${DNS_ID}" -H "Authorization: Bearer ${CF_TOKEN}" >/dev/null 2>&1
fi
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records" -H "Authorization: Bearer ${CF_TOKEN}" -H "Content-Type: application/json" --data "{\"type\":\"CNAME\",\"name\":\"${FQDN}\",\"content\":\"${TUNNEL_ID}.cfargotunnel.com\",\"proxied\":true}" >/dev/null 2>&1

# Function to process downstream devices
build_ingress() {
    local cfg="$1"
    local name ip proto
    config_get name "$cfg" name
    config_get ip "$cfg" ip
    config_get proto "$cfg" proto "http"
    
    if [ -n "$name" ] && [ -n "$ip" ]; then
        DEV_FQDN="${name}.${CF_DOMAIN}"
        
        if [ "$proto" = "https" ]; then
            INGRESS="${INGRESS},{\"hostname\":\"${DEV_FQDN}\",\"service\":\"${proto}://${ip}\",\"originRequest\":{\"noTLSVerify\":true}}"
        else
            INGRESS="${INGRESS},{\"hostname\":\"${DEV_FQDN}\",\"service\":\"${proto}://${ip}\"}"
        fi
        
        echo "\xf0\x9f\x9f\xa1 Setting up DNS for ${name}..." > "$STATUS_FILE"
        D_RES=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records?name=${DEV_FQDN}" -H "Authorization: Bearer ${CF_TOKEN}")
        D_ID=$(echo "$D_RES" | jsonfilter -e '@.result[0].id' 2>/dev/null)
        if [ -n "$D_ID" ]; then
             curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records/${D_ID}" -H "Authorization: Bearer ${CF_TOKEN}" >/dev/null 2>&1
        fi
        curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records" -H "Authorization: Bearer ${CF_TOKEN}" -H "Content-Type: application/json" --data "{\"type\":\"CNAME\",\"name\":\"${DEV_FQDN}\",\"content\":\"${TUNNEL_ID}.cfargotunnel.com\",\"proxied\":true}" >/dev/null 2>&1
    fi
}

# Load UCI and loop devices
config_load cloud
config_foreach build_ingress device

# Close Ingress Array
INGRESS="${INGRESS},{\"service\":\"http_status:404\"}]"

# Upload Ingress configuration to Cloudflare
echo "\xf0\x9f\x9f\xa1 Uploading Ingress Rules..." > "$STATUS_FILE"
curl -s -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/cfd_tunnel/${TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{\"config\":{\"ingress\":${INGRESS}}}" >/dev/null 2>&1

# Step 6: Run Tunnel (foreground, procd monitors it)
echo "\xf0\x9f\x9f\xa1 Starting Tunnel..." > "$STATUS_FILE"

# Run via Token (Remotely Managed)
cloudflared tunnel --protocol http2 run --token "$TUNNEL_TOKEN" 2>&1 | while IFS= read -r line; do
    if echo "$line" | grep -q 'Registered tunnel connection'; then
        echo "\xf0\x9f\x9f\xa2 Online" > "$STATUS_FILE"
        echo "https://${FQDN}" > "$URL_FILE"
    fi
    if echo "$line" | grep -q 'ERR'; then
        echo "\xf0\x9f\x94\xb4 Error: Tunnel disconnected" > "$STATUS_FILE"
    fi
done
CLOUDEOF
chmod +x files/usr/bin/cloud-daemon.sh

# 6. Init Script (Procd supervision with triggers)
cat << 'EOF' > files/etc/init.d/cloud
#!/bin/sh /etc/rc.common
START=99
STOP=10
USE_PROCD=1
start_service() {
    local enabled
    config_load cloud
    config_get enabled main enabled 0
    if [ "$enabled" = "1" ]; then
        procd_open_instance
        procd_set_param command /usr/bin/cloud-daemon.sh
        procd_set_param respawn 3600 5 0
        procd_set_param stdout 1
        procd_set_param stderr 1
        procd_close_instance
    else
        echo "\xf0\x9f\x94\xb4 Offline" > /tmp/cloud.status
        > /tmp/cloud.url
    fi
}
stop_service() {
    echo "\xf0\x9f\x94\xb4 Offline" > /tmp/cloud.status
    > /tmp/cloud.url
    killall cloudflared 2>/dev/null
}
service_triggers() {
    procd_add_reload_trigger "cloud"
}
reload_service() {
    stop
    start
}
EOF
chmod +x files/etc/init.d/cloud

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
