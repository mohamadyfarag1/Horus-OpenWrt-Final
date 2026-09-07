#!/bin/sh
# ========================================================
# Horus Cloudflare Zero-Trust Tunnel Daemon
# Supports Direct Token Mode and Custom API Mode
# ========================================================

STATUS_FILE="/tmp/cloud.status"
URL_FILE="/tmp/cloud.url"
LOG_FILE="/tmp/cloud.log"

set_status() {
    echo "$1" > "$STATUS_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# 1. Read UCI Configuration
MODE=$(uci -q get cloud.main.mode)
[ -z "$MODE" ] && MODE="token"

CF_TUNNEL_TOKEN=$(uci -q get cloud.main.cf_tunnel_token)
CF_DOMAIN=$(uci -q get cloud.main.cf_domain)
[ -z "$CF_DOMAIN" ] && CF_DOMAIN="opsegypt.com"

CF_ACCOUNT=$(uci -q get cloud.main.cf_account)
CF_ZONE=$(uci -q get cloud.main.cf_zone)
CF_TOKEN=$(uci -q get cloud.main.cf_token)

# 2. Get Unique Hardware MAC Address
MAC=""
for iface in br-lan eth0 lan1 lan2; do
    if [ -f "/sys/class/net/$iface/address" ]; then
        MAC=$(cat "/sys/class/net/$iface/address" 2>/dev/null | tr -d ': \r\n' | tr '[:upper:]' '[:lower:]')
        [ -n "$MAC" ] && break
    fi
done
[ -z "$MAC" ] && MAC="horusap"

TUNNEL_NAME="Horus-${MAC}"
FQDN="${MAC}.${CF_DOMAIN}"

> "$URL_FILE"

# 3. Check Internet Connectivity
if ! ping -c 1 -W 3 1.1.1.1 >/dev/null 2>&1 && ! ping -c 1 -W 3 8.8.8.8 >/dev/null 2>&1; then
    set_status "🔴 خطأ: لا يوجد اتصال بالإنترنت (يرجى توصيل كابل WAN)"
    exit 1
fi

# 4. Check / Install cloudflared Binary
if ! command -v cloudflared >/dev/null 2>&1; then
    set_status "🟡 جاري فحص مساحة التخزين وتثبيت cloudflared..."
    FREE_KB=$(df -k / | awk 'NR==2 {print $4}')
    if [ -n "$FREE_KB" ] && [ "$FREE_KB" -lt 15000 ]; then
        set_status "🔴 خطأ: المساحة غير كافية لتثبيت cloudflared (يلزم 15MB أو USB Extroot)"
        exit 1
    fi
    opkg update >/dev/null 2>&1
    opkg install cloudflared >/dev/null 2>&1
    if ! command -v cloudflared >/dev/null 2>&1; then
        set_status "🔴 خطأ: فشل تثبيت حزمة cloudflared عبر opkg"
        exit 1
    fi
fi

# ========================================================
# Execution Mode: DIRECT TOKEN (Recommended)
# ========================================================
if [ "$MODE" = "token" ]; then
    if [ -z "$CF_TUNNEL_TOKEN" ]; then
        set_status "🔴 خطأ: لم يتم إدخال رمز النفق (Tunnel Token)"
        exit 1
    fi

    set_status "🟡 جاري تشغيل نفق كلاود فلير..."
    echo "https://${FQDN}" > "$URL_FILE"

    cloudflared tunnel --protocol http2 run --token "$CF_TUNNEL_TOKEN" 2>&1 | while IFS= read -r line; do
        echo "$line" >> "$LOG_FILE"
        if echo "$line" | grep -q 'Registered tunnel connection'; then
            set_status "🟢 متصل بنجاح (Online)"
        elif echo "$line" | grep -qi 'ERR\|error\|failed'; then
            set_status "🔴 خطأ في الاتصال: $(echo "$line" | cut -c1-60)"
        fi
    done
    exit 0
fi

# ========================================================
# Execution Mode: FULL API AUTOMATION
# ========================================================
if [ -z "$CF_TOKEN" ] || [ -z "$CF_ACCOUNT" ] || [ -z "$CF_ZONE" ]; then
    set_status "🔴 خطأ: بيانات الـ API غير مكتملة (Account ID / Zone ID / API Token)"
    exit 1
fi

set_status "🟡 جاري الاتصال بخوادم Cloudflare API..."

# Find or Create Tunnel
OLD_TUNNELS=$(curl -s -X GET \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/cfd_tunnel?name=${TUNNEL_NAME}&is_deleted=false" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json")
TUNNEL_ID=$(echo "$OLD_TUNNELS" | jsonfilter -e '@.result[0].id' 2>/dev/null)

if [ -n "$TUNNEL_ID" ]; then
    set_status "🟡 تم العثور على نفق سابق، جاري استعادة الاتصال..."
else
    set_status "🟡 جاري إنشاء نفق جديد (${TUNNEL_NAME})..."
    RES=$(curl -s -X POST \
      "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/cfd_tunnel" \
      -H "Authorization: Bearer ${CF_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "{\"name\":\"${TUNNEL_NAME}\", \"config_src\":\"cloudflare\"}")
    TUNNEL_ID=$(echo "$RES" | jsonfilter -e '@.result.id' 2>/dev/null)

    if [ -z "$TUNNEL_ID" ]; then
        ERR_MSG=$(echo "$RES" | jsonfilter -e '@.errors[0].message' 2>/dev/null)
        set_status "🔴 خطأ في API إنشاء النفق: ${ERR_MSG:-فشل التحقق}"
        exit 1
    fi
fi

# Retrieve Tunnel Token
TOKEN_RES=$(curl -s -X GET \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/cfd_tunnel/${TUNNEL_ID}/token" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json")
RUN_TOKEN=$(echo "$TOKEN_RES" | jsonfilter -e '@.result' 2>/dev/null)

if [ -z "$RUN_TOKEN" ]; then
    set_status "🔴 خطأ: تعذر استلام رمز تشغيل النفق من كلاود فلير"
    exit 1
fi

# Setup Main Router DNS Record
set_status "🟡 جاري ضبط سجلات DNS..."
DNS_RES=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records?name=${FQDN}" -H "Authorization: Bearer ${CF_TOKEN}")
DNS_ID=$(echo "$DNS_RES" | jsonfilter -e '@.result[0].id' 2>/dev/null)
if [ -n "$DNS_ID" ]; then
    curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records/${DNS_ID}" -H "Authorization: Bearer ${CF_TOKEN}" >/dev/null 2>&1
fi
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{\"type\":\"CNAME\",\"name\":\"${FQDN}\",\"content\":\"${TUNNEL_ID}.cfargotunnel.com\",\"proxied\":true}" >/dev/null 2>&1

# Build Ingress Array
INGRESS="[{\"hostname\":\"${FQDN}\",\"service\":\"http://127.0.0.1:80\"}"

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

        # Update DNS for device
        D_RES=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records?name=${DEV_FQDN}" -H "Authorization: Bearer ${CF_TOKEN}")
        D_ID=$(echo "$D_RES" | jsonfilter -e '@.result[0].id' 2>/dev/null)
        if [ -n "$D_ID" ]; then
            curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records/${D_ID}" -H "Authorization: Bearer ${CF_TOKEN}" >/dev/null 2>&1
        fi
        curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records" \
          -H "Authorization: Bearer ${CF_TOKEN}" \
          -H "Content-Type: application/json" \
          --data "{\"type\":\"CNAME\",\"name\":\"${DEV_FQDN}\",\"content\":\"${TUNNEL_ID}.cfargotunnel.com\",\"proxied\":true}" >/dev/null 2>&1
    fi
}

. /lib/functions.sh
config_load cloud
config_foreach build_ingress device

INGRESS="${INGRESS},{\"service\":\"http_status:404\"}]"

# Upload Ingress Configuration
set_status "🟡 جاري حفظ وتطبيق مسارات التوجيه (Ingress Rules)..."
curl -s -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/cfd_tunnel/${TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{\"config\":{\"ingress\":${INGRESS}}}" >/dev/null 2>&1

set_status "🟡 جاري بدء تشغيل النفق..."
echo "https://${FQDN}" > "$URL_FILE"

cloudflared tunnel --protocol http2 run --token "$RUN_TOKEN" 2>&1 | while IFS= read -r line; do
    echo "$line" >> "$LOG_FILE"
    if echo "$line" | grep -q 'Registered tunnel connection'; then
        set_status "🟢 متصل بنجاح (Online)"
    elif echo "$line" | grep -qi 'ERR\|error\|failed'; then
        set_status "🔴 خطأ في الاتصال: $(echo "$line" | cut -c1-60)"
    fi
done
