# =====================================================================
# HAMax Module: Hardware Survey, Station Links & JSON Telemetry Builder
# =====================================================================

# ---------------------------------------------------------------------
# telemetry
# ---------------------------------------------------------------------
hamax_json_escape() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

# Each helper prints one JSON object per line; the trailing pipeline
# turns those lines into a comma-separated array body. Empty input
# yields empty output, which is a valid empty array.
hamax_join_json_lines() {
    sed '$!s/$/,/' | tr -d '\n'
}

# Radio survey for the channel actually in use: noise floor and how much
# of the air is occupied. mac80211 counts busy/active time in the hardware.
# Emits: freq noise active busy rx tx (times in ms, empty if absent)
hamax_survey_raw() {
    local ifname="$1"
    iw dev "$ifname" survey dump 2>/dev/null | awk '
        /^Survey data from/                { inuse = 0 }
        /frequency:/ && /\[in use\]/       { inuse = 1; freq = $2 }
        inuse && /noise:/                  { noise = $2 }
        inuse && /channel active time:/    { act  = $4 }
        inuse && /channel busy time:/      { busy = $4 }
        inuse && /channel receive time:/   { rxt  = $4 }
        inuse && /channel transmit time:/  { txt  = $4 }
        END { print freq, noise, act, busy, rxt, txt }
    '
}

hamax_survey_json() {
    local ifname freq noise act busy rxt txt util="" tx_pct="" rx_pct="" intf_pct="" free_pct=""

    for ifname in $(hamax_live_ifnames "$RADIO"); do
        set -- $(hamax_survey_raw "$ifname")
        freq="$1"; noise="$2"; act="$3"; busy="$4"; rxt="$5"; txt="$6"
        [ -n "$freq" ] && break
    done

    [ -n "$freq" ] || { printf 'null'; return; }

    # Utilisation & AirTime percentages
    if [ -n "$act" ] && [ -n "$busy" ] && [ "$act" -gt 0 ] 2>/dev/null; then
        util=$((busy * 100 / act))
        [ -n "$txt" ] && tx_pct=$((txt * 100 / act))
        [ -n "$rxt" ] && rx_pct=$((rxt * 100 / act))
        if [ -n "$txt" ] && [ -n "$rxt" ] && [ "$busy" -ge $((txt + rxt)) ]; then
            intf_pct=$(((busy - txt - rxt) * 100 / act))
        else
            intf_pct=0
        fi
        if [ "$act" -ge "$busy" ]; then
            free_pct=$(((act - busy) * 100 / act))
        else
            free_pct=0
        fi
    fi

    printf '{"freq":"%s","noise":"%s","active_ms":"%s","busy_ms":"%s","rx_ms":"%s","tx_ms":"%s","util":"%s","tx_pct":"%s","rx_pct":"%s","intf_pct":"%s","free_pct":"%s"}' \
        "$freq" "$noise" "$act" "$busy" "$rxt" "$txt" "$util" "$tx_pct" "$rx_pct" "$intf_pct" "$free_pct"
}

hamax_ap_links_json() {
    local ifname

    for ifname in $(hamax_live_ifnames "$RADIO"); do
        iw dev "$ifname" info 2>/dev/null | grep -q 'type AP' || continue

        iw dev "$ifname" station dump 2>/dev/null | awk -v iface="$ifname" '
            BEGIN {
                while ((getline line < "/proc/net/arp") > 0) {
                    split(line, f)
                    if (f[4] ~ /^[0-9a-fA-F:]+$/) {
                        ip_by_mac[tolower(f[4])] = f[1]
                    }
                }
                close("/proc/net/arp")
                while ((getline line < "/tmp/dhcp.leases") > 0) {
                    split(line, f)
                    if (f[2] ~ /^[0-9a-fA-F:]+$/) {
                        if (f[3] != "") ip_by_mac[tolower(f[2])] = f[3]
                        if (f[4] != "" && f[4] != "*") name_by_mac[tolower(f[2])] = f[4]
                    }
                }
                close("/tmp/dhcp.leases")
            }
            function emit() {
                if (mac == "") return
                lmac = tolower(mac)
                ip = ip_by_mac[lmac]
                hname = name_by_mac[lmac]
                if (hname == "") hname = "Station-" substr(mac, 13, 2) substr(mac, 16, 2)
                printf("{\"iface\":\"%s\",\"mac\":\"%s\",\"ip\":\"%s\",\"name\":\"%s\",\"signal\":\"%s\",\"signal_avg\":\"%s\",\"chain0\":\"%s\",\"chain1\":\"%s\",\"chain_diff\":\"%s\",\"tx_bytes\":\"%s\",\"rx_bytes\":\"%s\",\"tx_packets\":\"%s\",\"tx_rate\":\"%s\",\"rx_rate\":\"%s\",\"tx_bitrate_full\":\"%s\",\"rx_bitrate_full\":\"%s\",\"expected\":\"%s\",\"weight\":\"%s\",\"inactive\":\"%s\",\"connected\":\"%s\",\"tx_retries\":\"%s\",\"tx_failed\":\"%s\"}\n",
                       iface, mac, ip, hname, sig, sigavg, ch0, ch1, chdiff, txb, rxb, txp, txr, rxr, tx_full, rx_full, ethr, wt, inact, conn, retries, failed)
                mac = ""; sig = ""; sigavg = ""; ch0 = ""; ch1 = ""; chdiff = ""; txb = ""; rxb = ""; txp = ""; txr = ""; rxr = ""
                tx_full = ""; rx_full = ""; ethr = ""; wt = ""; inact = ""; conn = ""; retries = ""; failed = ""
            }
            /^Station/              { emit(); mac = $2; next }
            /inactive time:/        { inact   = $3 }
            /rx bytes:/             { rxb     = $3 }
            /tx bytes:/             { txb     = $3 }
            /tx packets:/           { txp     = $3 }
            /tx retries:/           { retries = $3 }
            /tx failed:/            { failed  = $3 }
            /signal:/ && !/signal avg:/ {
                sig = $2
                if ($3 ~ /^\[/) {
                    c0 = $3; gsub(/[\[,]/, "", c0); ch0 = c0
                    c1 = $4; gsub(/[\]]/, "", c1); ch1 = c1
                    d = ch0 - ch1; if (d < 0) d = -d; chdiff = d
                }
            }
            /signal avg:/           { sigavg  = $3 }
            /tx bitrate:/           {
                txr = $3
                raw = $0; sub(/^[ \t]*tx bitrate:[ \t]*/, "", raw); gsub(/"/, "\\\"", raw); tx_full = raw
            }
            /rx bitrate:/           {
                rxr = $3
                raw = $0; sub(/^[ \t]*rx bitrate:[ \t]*/, "", raw); gsub(/"/, "\\\"", raw); rx_full = raw
            }
            /expected throughput:/  { ethr    = $3 }
            /airtime weight:/       { wt      = $3 }
            /connected time:/       { conn    = $3 }
            END                     { emit() }
        '
    done | hamax_join_json_lines
}

hamax_sta_links_json() {
    local ifname info

    for ifname in $(hamax_live_ifnames "$RADIO"); do
        iw dev "$ifname" info 2>/dev/null | grep -q 'type managed' || continue

        info=$(iw dev "$ifname" link 2>/dev/null)

        if echo "$info" | grep -q '^Connected to'; then
            printf '%s\n' "$info" | awk -v iface="$ifname" '
                /^Connected to/ { bssid = $3 }
                /SSID:/         { ssid  = $2 }
                /freq:/         { freq  = $2 }
                /signal:/       {
                    sig   = $2
                    if ($3 ~ /^\[/) {
                        c0 = $3; gsub(/[\[,]/, "", c0); ch0 = c0
                        c1 = $4; gsub(/[\]]/, "", c1); ch1 = c1
                        d = ch0 - ch1; if (d < 0) d = -d; chdiff = d
                    }
                }
                /rx bitrate:/   {
                    rxr   = $3
                    raw = $0; sub(/^[ \t]*rx bitrate:[ \t]*/, "", raw); gsub(/"/, "\\\"", raw); rx_full = raw
                }
                /tx bitrate:/   {
                    txr   = $3
                    raw = $0; sub(/^[ \t]*tx bitrate:[ \t]*/, "", raw); gsub(/"/, "\\\"", raw); tx_full = raw
                }
                /RX:/           { rxb   = $2 }
                /TX:/           { txb   = $2 }
                END {
                    printf("{\"iface\":\"%s\",\"connected\":true,\"bssid\":\"%s\",\"ssid\":\"%s\",\"freq\":\"%s\",\"signal\":\"%s\",\"chain0\":\"%s\",\"chain1\":\"%s\",\"chain_diff\":\"%s\",\"tx_rate\":\"%s\",\"rx_rate\":\"%s\",\"tx_bitrate_full\":\"%s\",\"rx_bitrate_full\":\"%s\",\"tx_bytes\":\"%s\",\"rx_bytes\":\"%s\"}\n",
                           iface, bssid, ssid, freq, sig, ch0, ch1, chdiff, txr, rxr, tx_full, rx_full, txb, rxb)
                }
            '
        else
            printf '{"iface":"%s","connected":false}\n' "$(hamax_json_escape "$ifname")"
        fi
    done | hamax_join_json_lines
}

# The channel plan as JSON, annotated with what the running driver
# actually offers and whether a stock client would ever scan there.
hamax_channels_json() {
    local c std
    {
        for c in $HAMAX_CHANS; do
            hamax_chan_state_var "$c"
            hamax_chan_is_standard "$c" && std=true || std=false
            printf '{"channel":%d,"freq":%d,"state":"%s","standard":%s}\n' \
                   "$c" "$((5000 + 5 * c))" "$CHAN_STATE" "$std"
        done
    } | hamax_join_json_lines
}

hamax_write_json() {
    local state role since links radio_band chan htmode cur_freq offgrid txpower ssid dist gain lan_speed

    state="disabled"
    [ "$(uci -q get hamax.settings.enabled)" = "1" ] && state="enabled"

    since=$(cat "$HAMAX_SINCE" 2>/dev/null)
    offgrid=false

    dist=$(uci -q get hamax.settings.distance || echo "5000")
    gain=$(uci -q get hamax.settings.antenna_gain || echo "")

    lan_speed="1000 Mbps-Full"
    for s in /sys/class/net/eth*/speed; do
        if [ -r "$s" ]; then
            val=$(cat "$s" 2>/dev/null)
            [ -n "$val" ] && [ "$val" -gt 0 ] 2>/dev/null && { lan_speed="${val} Mbps-Full"; break; }
        fi
    done

    if [ -n "$RADIO" ]; then
        role=$(hamax_role "$RADIO")
        radio_band=$(uci -q get "wireless.${RADIO}.band")
        chan=$(uci -q get "wireless.${RADIO}.channel")
        htmode=$(uci -q get "wireless.${RADIO}.htmode")

        for ifn in $(hamax_live_ifnames "$RADIO"); do
            txpower=$(iw dev "$ifn" info 2>/dev/null | sed -n 's/.*txpower \([0-9.]*\) dBm.*/\1/p' | head -n1)
            ssid=$(iw dev "$ifn" info 2>/dev/null | sed -n 's/.*ssid \(.*\)/\1/p' | head -n1)
            [ -n "$ssid" ] && break
        done

        if [ -n "$chan" ] && [ "$chan" != "auto" ]; then
            cur_freq=$(hamax_chan_freq "$chan" 2>/dev/null)
            hamax_chan_is_standard "$chan" || offgrid=true
        fi

        if [ "$role" = "client" ]; then
            links=$(hamax_sta_links_json)
        else
            links=$(hamax_ap_links_json)
        fi
    else
        role="ap"
        links=""
    fi

    cat > "$HAMAX_JSON" <<EOF
{
  "state": "$(hamax_json_escape "$state")",
  "role": "$(hamax_json_escape "$role")",
  "profile": "$(hamax_json_escape "$PROFILE")",
  "device_model": "Horus Rocket 5AC",
  "radio": "$(hamax_json_escape "${RADIO:-}")",
  "band": "$(hamax_json_escape "${radio_band:-}")",
  "channel": "$(hamax_json_escape "${chan:-}")",
  "htmode": "$(hamax_json_escape "${htmode:-}")",
  "freq": "$(hamax_json_escape "${cur_freq:-}")",
  "txpower": "$(hamax_json_escape "${txpower:-24.00}")",
  "ssid": "$(hamax_json_escape "${ssid:-}")",
  "distance": "$(hamax_json_escape "${dist}")",
  "antenna_gain": "$(hamax_json_escape "${gain}")",
  "lan_speed": "$(hamax_json_escape "${lan_speed}")",
  "offgrid": $offgrid,
  "stealth": $([ "$STEALTH" = "1" ] && echo true || echo false),
  "isolation": $([ "$ISOLATION" = "1" ] && echo true || echo false),
  "since": "$(hamax_json_escape "${since:-}")",
  "updated": "$(date '+%Y-%m-%d %H:%M:%S')",
  "survey": $(hamax_survey_json),
  "caps": {
    "airtime_hostapd": $([ "$CAP_AIRTIME" = "1" ] && echo true || echo false),
    "airtime_kernel": $([ "$CAP_ATF_KERNEL" = "1" ] && echo true || echo false),
    "vendor_ie": $([ "$CAP_VENDOR_IE" = "1" ] && echo true || echo false),
    "ath10k_ct": $([ "$CAP_ATH10K_CT" = "1" ] && echo true || echo false),
    "mcast_to_ucast": $([ "$MCAST_TO_UCAST" = "1" ] && echo true || echo false),
    "buffer_tuning": $([ "$TUNE_BUFFERS" = "1" ] && echo true || echo false)
  },
  "links": [${links}]
}
EOF
}
