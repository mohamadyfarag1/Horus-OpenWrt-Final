#!/bin/sh
# =====================================================
# RADIUS Sync Background Daemon
# Fetches online users & quotas from SAS/DMA/ADV servers
# =====================================================

JSON_OUT="/tmp/horus_radius.json"
[ ! -f "$JSON_OUT" ] && echo '{"data":[]}' > "$JSON_OUT"

# ── Helpers ──────────────────────────────────────────
url_enc() {
    printf '%s' "$1" | sed \
        -e 's/%/%25/g' -e 's/ /%20/g' -e 's/#/%23/g' \
        -e 's/&/%26/g' -e 's/+/%2B/g' -e 's/=/%3D/g' -e 's/?/%3F/g'
}

get_host() { echo "$1" | sed 's|^http[s]*://||;s|/.*||;s|:.*||'; }
get_port() {
    _x=$(echo "$1" | sed 's|^http[s]*://||;s|/.*||')
    case "$_x" in *:*) echo "$_x" | sed 's|.*:||' ;; *) echo 80 ;; esac
}
get_path() {
    _x=$(echo "$1" | sed 's|^http[s]*://[^/]*||')
    [ -z "$_x" ] && _x="/"
    echo "$_x"
}

nc_post() {
    _url="$1"; _body="$2"; _auth="$3"
    _h=$(get_host "$_url"); _p=$(get_port "$_url"); _pth=$(get_path "$_url")
    _l=$(printf "%s" "$_body" | wc -c)
    if [ -n "$_auth" ]; then
        _req="POST $_pth HTTP/1.1\r\nHost: $_h\r\nAuthorization: Bearer $_auth\r\nContent-Type: application/json\r\nContent-Length: $_l\r\nConnection: close\r\n\r\n$_body"
    else
        _req="POST $_pth HTTP/1.1\r\nHost: $_h\r\nContent-Type: application/json\r\nContent-Length: $_l\r\nConnection: close\r\n\r\n$_body"
    fi
    printf "%b" "$_req" | nc "$_h" "$_p" 2>/dev/null | awk 'BEGIN{b=0} /^\r?$/{b=1;next} {if(b) print}'
}

nc_get() {
    _url="$1"; _auth="$2"
    _h=$(get_host "$_url"); _p=$(get_port "$_url"); _pth=$(get_path "$_url")
    if [ -n "$_auth" ]; then
        _req="GET $_pth HTTP/1.1\r\nHost: $_h\r\nAuthorization: Bearer $_auth\r\nConnection: close\r\n\r\n"
    else
        _req="GET $_pth HTTP/1.1\r\nHost: $_h\r\nConnection: close\r\n\r\n"
    fi
    printf "%b" "$_req" | nc "$_h" "$_p" 2>/dev/null | awk 'BEGIN{b=0} /^\r?$/{b=1;next} {if(b) print}'
}

http_post() { nc_post "$1" "$2" "$3"; }
http_get() { nc_get "$1" "$2"; }

jval() {
    if command -v jsonfilter >/dev/null 2>&1; then
        printf '%s' "$1" | jsonfilter -e "@.$2" 2>/dev/null
    fi
}

# ── SAS Sync ─────────────────────────────────────────
sync_sas() {
    _BASE="$1" _USER="$2" _PASS="$3"

    LOGIN_URL=$(echo "$_BASE" | sed 's:/login$::;s:/$::')
    case "$LOGIN_URL" in
        */api) LOGIN_URL="${LOGIN_URL}/login" ;;
        */api/*) ;;
        *) LOGIN_URL="${LOGIN_URL}/admin/api/index.php/api/login" ;;
    esac

    KEY="abcdefghijuklmno0123456789012345"
    PLAIN="{\"username\":\"$_USER\",\"password\":\"$_PASS\"}"
    TOKEN_FILE="/tmp/sas_token.txt"
    TOKEN=""
    [ -f "$TOKEN_FILE" ] && TOKEN=$(cat "$TOKEN_FILE")

    if [ -z "$TOKEN" ]; then
        if command -v openssl >/dev/null 2>&1; then
            ENC=$(printf "%s" "$PLAIN" | openssl enc -aes-256-cbc -md md5 -a -A -k "$KEY" 2>/dev/null)
            [ -n "$ENC" ] && RAW=$(http_post "$LOGIN_URL" "{\"payload\":\"$ENC\"}" "")
            TOKEN=$(jval "$RAW" "token")
            [ -z "$TOKEN" ] && TOKEN=$(jval "$RAW" "data.token")
        fi

        if [ -z "$TOKEN" ]; then
            RAW=$(http_post "$LOGIN_URL" "$PLAIN" "")
            TOKEN=$(jval "$RAW" "token")
            [ -z "$TOKEN" ] && TOKEN=$(jval "$RAW" "data.token")
        fi

        if [ -z "$TOKEN" ]; then
            logger -t horus_controller "SAS login failed"
            return
        fi
        echo "$TOKEN" > "$TOKEN_FILE"
    fi

    FETCH_URL=$(echo "$LOGIN_URL" | sed 's:/login$:/index/online:')
    
    # 1. Reliable MAC extraction from all interfaces
    MACS=""
    if command -v iw >/dev/null 2>&1; then
        for iface in $(iw dev | awk '$1=="Interface"{print $2}'); do
            m=$(iw dev "$iface" station dump 2>/dev/null | awk '$1=="Station"{print toupper($2)}')
            [ -n "$m" ] && MACS="$MACS $m"
        done
    fi
    if command -v iwinfo >/dev/null 2>&1; then
        for iface in $(iwinfo | grep -E '^[a-zA-Z0-9_-]+' | awk '{print $1}'); do
            m=$(iwinfo "$iface" assoclist 2>/dev/null | grep -oE '([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}' | tr 'a-z' 'A-Z')
            [ -n "$m" ] && MACS="$MACS $m"
        done
    fi
    MACS=$(echo "$MACS" | tr ' ' '\n' | sort -u | grep -v '^$')
    
    if [ -z "$MACS" ]; then
        echo '{"data":[]}' > /tmp/horus_radius.tmp
        mv /tmp/horus_radius.tmp "$JSON_OUT"
        return
    fi
    
    JSON_RESULT='{"data":['
    FIRST=1
    TMP_DIR="/tmp/horus_radius_fetch"
    mkdir -p "$TMP_DIR"
    rm -f "$TMP_DIR"/*
    
    fetch_mac() {
        local mac="$1"
        local PLAIN_FETCH="{\"count\":1,\"search\":\"$mac\"}"
        local ONLINE_RAW=""
        if command -v openssl >/dev/null 2>&1; then
            local ENC_FETCH=$(printf "%s" "$PLAIN_FETCH" | openssl enc -aes-256-cbc -md md5 -a -A -k "$KEY" 2>/dev/null)
            ONLINE_RAW=$(http_post "$FETCH_URL" "{\"payload\":\"$ENC_FETCH\"}" "$TOKEN")
        else
            ONLINE_RAW=$(http_post "$FETCH_URL" "$PLAIN_FETCH" "$TOKEN")
        fi
        
        local UID=""
        local IP=""
        local SESSION=0
        local NAME=""
        local PROFILE=""
        local EXPIRATION=""
        local QUOTA=""
        local UNAME="$mac"
        
        if [ -n "$ONLINE_RAW" ]; then
            if echo "$ONLINE_RAW" | grep -qiE "expired|unauthorized|invalid token|error"; then
                if [ -n "$TOKEN" ] && [ -f "$TOKEN_FILE" ]; then
                    rm -f "$TOKEN_FILE"
                    logger -t horus_controller "SAS token expired/invalid, wiped token cache."
                    # We exit this subshell so main loop can retry next time
                    exit 1
                fi
            fi
            IP=$(printf '%s' "$ONLINE_RAW" | jsonfilter -e '@.data[0].framedipaddress' 2>/dev/null)
            SESSION=$(printf '%s' "$ONLINE_RAW" | jsonfilter -e '@.data[0].acctsessiontime' 2>/dev/null)
            UID=$(printf '%s' "$ONLINE_RAW" | jsonfilter -e '@.data[0].user_details.id' 2>/dev/null)
            NAME=$(printf '%s' "$ONLINE_RAW" | jsonfilter -e '@.data[0].user_details.firstname' 2>/dev/null)
            PROFILE=$(printf '%s' "$ONLINE_RAW" | jsonfilter -e '@.data[0].user_profile_name' 2>/dev/null)
            [ -z "$PROFILE" ] && PROFILE=$(printf '%s' "$ONLINE_RAW" | jsonfilter -e '@.data[0].user_details.profile_details.name' 2>/dev/null)
            EXPIRATION=$(printf '%s' "$ONLINE_RAW" | jsonfilter -e '@.data[0].user_details.expiration' 2>/dev/null)
            UNAME=$(printf '%s' "$ONLINE_RAW" | jsonfilter -e '@.data[0].username' 2>/dev/null)
        fi
        
        if [ -z "$UID" ] || [ "$UID" = "null" ]; then
            local USER_URL=$(echo "$LOGIN_URL" | sed 's:/login$:/index/user:')
            local PLAIN_U="{\"count\":1,\"search\":\"$mac\"}"
            local USER_RAW=""
            if command -v openssl >/dev/null 2>&1; then
                local ENC_U=$(printf "%s" "$PLAIN_U" | openssl enc -aes-256-cbc -md md5 -a -A -k "$KEY" 2>/dev/null)
                USER_RAW=$(http_post "$USER_URL" "{\"payload\":\"$ENC_U\"}" "$TOKEN")
            else
                USER_RAW=$(http_post "$USER_URL" "$PLAIN_U" "$TOKEN")
            fi
            if [ -n "$USER_RAW" ]; then
                UID=$(printf '%s' "$USER_RAW" | jsonfilter -e '@.data[0].id' 2>/dev/null)
                [ -z "$NAME" ] && NAME=$(printf '%s' "$USER_RAW" | jsonfilter -e '@.data[0].firstname' 2>/dev/null)
                [ -z "$PROFILE" ] && PROFILE=$(printf '%s' "$USER_RAW" | jsonfilter -e '@.data[0].profile_details.name' 2>/dev/null)
                [ -z "$EXPIRATION" ] && EXPIRATION=$(printf '%s' "$USER_RAW" | jsonfilter -e '@.data[0].expiration' 2>/dev/null)
                [ -z "$UNAME" ] && UNAME=$(printf '%s' "$USER_RAW" | jsonfilter -e '@.data[0].username' 2>/dev/null)
            fi
        fi
        
        if [ -n "$UID" ] && [ "$UID" != "null" ]; then
            local OV_URL=$(echo "$LOGIN_URL" | sed "s:/login$:/user/overview/${UID}:")
            local OV_RAW=$(http_get "$OV_URL" "$TOKEN")
            if [ -n "$OV_RAW" ]; then
                QUOTA=$(printf '%s' "$OV_RAW" | jsonfilter -e '@.data.remaining_rxtx' 2>/dev/null)
                [ -z "$NAME" ] && NAME=$(printf '%s' "$OV_RAW" | jsonfilter -e '@.data.firstname' 2>/dev/null)
                [ -z "$PROFILE" ] && PROFILE=$(printf '%s' "$OV_RAW" | jsonfilter -e '@.data.profile_name' 2>/dev/null)
                [ -z "$EXPIRATION" ] && EXPIRATION=$(printf '%s' "$OV_RAW" | jsonfilter -e '@.data.expiration' 2>/dev/null)
            fi
        fi
        
        [ -z "$SESSION" ] && SESSION=0
        [ "$NAME" = "null" ] && NAME=""
        [ "$PROFILE" = "null" ] && PROFILE=""
        [ "$EXPIRATION" = "null" ] && EXPIRATION=""
        [ "$IP" = "null" ] && IP=""
        [ "$QUOTA" = "null" ] && QUOTA=""
        [ "$UNAME" = "null" ] && UNAME="$mac"
        
        if [ -n "$NAME" ] || [ -n "$PROFILE" ] || [ -n "$IP" ]; then
            # Safe filename for mac
            local safe_mac=$(echo "$mac" | tr -d ':')
            echo "{\"mac\":\"$mac\",\"name\":\"$NAME\",\"profile\":\"$PROFILE\",\"expiration\":\"$EXPIRATION\",\"quota\":\"$QUOTA\",\"ip\":\"$IP\",\"session\":$SESSION,\"username\":\"$UNAME\"}" > "$TMP_DIR/$safe_mac"
        fi
    }
    
    # Run fetchers in parallel
    for mac in $MACS; do
        fetch_mac "$mac" &
    done
    wait
    
    # Assemble results
    for f in "$TMP_DIR"/*; do
        [ -f "$f" ] || continue
        [ $FIRST -eq 0 ] && JSON_RESULT="${JSON_RESULT},"
        JSON_RESULT="${JSON_RESULT}$(cat "$f")"
        FIRST=0
    done
    
    JSON_RESULT="${JSON_RESULT}]}"
    
    if [ "$FIRST" = "1" ]; then
        JSON_RESULT='{"data":[]}'
    fi
    echo "$JSON_RESULT" > /tmp/horus_radius.tmp
    mv /tmp/horus_radius.tmp "$JSON_OUT"

}

# ── DMA Sync ─────────────────────────────────────────
sync_dma() {
    _BASE="$1" _USER="$2" _PASS="$3" _KEY="$4"
    [ -z "$_KEY" ] && _KEY="Mohamady_Radius_2026"

    DMA_URL="$_BASE"
    case "$DMA_URL" in
        *.php) ;;
        *) DMA_URL="${DMA_URL%/}/user_api.php" ;;
    esac

    E_KEY=$(url_enc "$_KEY")
    E_USER=$(url_enc "$_USER")
    E_PASS=$(url_enc "$_PASS")

    RAW=$(http_get "${DMA_URL}?key=${E_KEY}&admin_user=${E_USER}&admin_pass=${E_PASS}&action=online" "")

    if [ -n "$RAW" ] && echo "$RAW" | grep -q '{'; then
        echo "$RAW" > /tmp/horus_radius.tmp
        mv /tmp/horus_radius.tmp "$JSON_OUT"
        logger -t horus_controller "DMA sync OK"
    else
        logger -t horus_controller "DMA: no valid response"
    fi
}

# ── ADV Sync ─────────────────────────────────────────
sync_adv() {
    _BASE="$1" _USER="$2" _PASS="$3" _KEY="$4"

    ADV_URL=$(echo "$_BASE" | sed 's:/login\.php$::;s:/login$::')
    MD5_PASS=$(printf "%s" "$_PASS" | md5sum | awk '{print $1}')

    PAYLOAD="{\"username\":\"$_USER\",\"password\":\"$MD5_PASS\",\"password_plain\":\"$_PASS\",\"master_key\":\"$_KEY\"}"
    RAW=$(http_post "${ADV_URL}/login" "$PAYLOAD" "")
    TOKEN=$(jval "$RAW" "token")
    [ -z "$TOKEN" ] && TOKEN=$(jval "$RAW" "data.token")

    if [ -z "$TOKEN" ]; then
        logger -t horus_controller "ADV login failed"
        return
    fi

    USERS_RAW=$(http_post "${ADV_URL}/get_online_users" '{}' "$TOKEN")
    if [ -n "$USERS_RAW" ] && echo "$USERS_RAW" | grep -q '{'; then
        echo "$USERS_RAW" > /tmp/horus_radius.tmp
        mv /tmp/horus_radius.tmp "$JSON_OUT"
        logger -t horus_controller "ADV sync OK"
    fi
}

# ── Main Loop ────────────────────────────────────────
while true; do
    ENABLED=$(uci -q get horus_controller.main.enabled)
    if [ "$ENABLED" = "1" ]; then
        RTYPE=$(uci -q get horus_controller.main.radius_type)
        BASE_URL=$(uci -q get horus_controller.main.base_url | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s:/*$::')
        USERNAME=$(uci -q get horus_controller.main.username)
        PASSWORD=$(uci -q get horus_controller.main.password)
        API_KEY=$(uci -q get horus_controller.main.api_key)
        INTERVAL=$(uci -q get horus_controller.main.sync_interval)
        [ -z "$RTYPE" ] && RTYPE="sas"
        [ -z "$INTERVAL" ] && INTERVAL=10
        { [ "$INTERVAL" -lt 5 ] 2>/dev/null && INTERVAL=10; } || true

        case "$BASE_URL" in
            http://*|https://*) ;;
            *) BASE_URL="http://$BASE_URL" ;;
        esac

        if [ -n "$BASE_URL" ] && [ -n "$USERNAME" ]; then
            case "$RTYPE" in
                sas) sync_sas "$BASE_URL" "$USERNAME" "$PASSWORD" ;;
                dma) sync_dma "$BASE_URL" "$USERNAME" "$PASSWORD" "$API_KEY" ;;
                adv) sync_adv "$BASE_URL" "$USERNAME" "$PASSWORD" "$API_KEY" ;;
            esac
        fi

        sleep "$INTERVAL"
    else
        echo '{"data":[]}' > /tmp/horus_radius.tmp
        mv /tmp/horus_radius.tmp "$JSON_OUT"
        sleep 15
    fi
done
