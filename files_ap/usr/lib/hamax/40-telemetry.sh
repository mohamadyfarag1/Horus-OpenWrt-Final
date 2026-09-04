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
# of the air is occupied. This is the honest source for the numbers an
# airMAX UI shows as "airtime" - mac80211 counts busy/active time in the
# hardware, so channel utilisation here includes other people's traffic
# and interference, not just ours.
#
# Emits: freq noise active busy rx tx      (times in ms, empty if absent)
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
    local ifname freq noise act busy rxt txt util=""

    for ifname in $(hamax_live_ifnames "$RADIO"); do
        set -- $(hamax_survey_raw "$ifname")
        freq="$1"; noise="$2"; act="$3"; busy="$4"; rxt="$5"; txt="$6"
        [ -n "$freq" ] && break
    done

    [ -n "$freq" ] || { printf 'null'; return; }

    # Utilisation is only meaningful when the driver gave us both halves.
    if [ -n "$act" ] && [ -n "$busy" ] && [ "$act" -gt 0 ] 2>/dev/null; then
        util=$((busy * 100 / act))
    fi

    printf '{"freq":"%s","noise":"%s","active_ms":"%s","busy_ms":"%s","rx_ms":"%s","tx_ms":"%s","util":"%s"}' \
        "$freq" "$noise" "$act" "$busy" "$rxt" "$txt" "$util"
}

hamax_ap_links_json() {
    local ifname

    for ifname in $(hamax_live_ifnames "$RADIO"); do
        iw dev "$ifname" info 2>/dev/null | grep -q 'type AP' || continue

        iw dev "$ifname" station dump 2>/dev/null | awk -v iface="$ifname" '
            function emit() {
                if (mac == "") return
                printf("{\"iface\":\"%s\",\"mac\":\"%s\",\"signal\":\"%s\",\"signal_avg\":\"%s\",\"tx_bytes\":\"%s\",\"rx_bytes\":\"%s\",\"tx_packets\":\"%s\",\"tx_rate\":\"%s\",\"rx_rate\":\"%s\",\"expected\":\"%s\",\"weight\":\"%s\",\"inactive\":\"%s\",\"connected\":\"%s\",\"tx_retries\":\"%s\",\"tx_failed\":\"%s\"}\n",
                       iface, mac, sig, sigavg, txb, rxb, txp, txr, rxr, ethr, wt, inact, conn, retries, failed)
                mac = ""; sig = ""; sigavg = ""; txb = ""; rxb = ""; txp = ""; txr = ""; rxr = ""
                ethr = ""; wt = ""; inact = ""; conn = ""; retries = ""; failed = ""
            }
            /^Station/              { emit(); mac = $2; next }
            /inactive time:/        { inact   = $3 }
            /rx bytes:/             { rxb     = $3 }
            /tx bytes:/             { txb     = $3 }
            /tx packets:/           { txp     = $3 }
            /tx retries:/           { retries = $3 }
            /tx failed:/            { failed  = $3 }
            /signal:/               { sig     = $2 }
            /signal avg:/           { sigavg  = $3 }
            /tx bitrate:/           { txr     = $3 }
            /rx bitrate:/           { rxr     = $3 }
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
            # "RX:"/"TX:" are the byte counters; the bitrate lines are
            # lowercase ("rx bitrate:"), so the patterns cannot collide.
            printf '%s\n' "$info" | awk -v iface="$ifname" '
                /^Connected to/ { bssid = $3 }
                /SSID:/         { ssid  = $2 }
                /freq:/         { freq  = $2 }
                /signal:/       { sig   = $2 }
                /rx bitrate:/   { rxr   = $3 }
                /tx bitrate:/   { txr   = $3 }
                /RX:/           { rxb   = $2 }
                /TX:/           { txb   = $2 }
                END {
                    printf("{\"iface\":\"%s\",\"connected\":true,\"bssid\":\"%s\",\"ssid\":\"%s\",\"freq\":\"%s\",\"signal\":\"%s\",\"tx_rate\":\"%s\",\"rx_rate\":\"%s\",\"tx_bytes\":\"%s\",\"rx_bytes\":\"%s\"}\n",
                           iface, bssid, ssid, freq, sig, txr, rxr, txb, rxb)
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
    local state role since links radio_band chan htmode cur_freq offgrid

    state="disabled"
    [ "$(uci -q get hamax.settings.enabled)" = "1" ] && state="enabled"

    since=$(cat "$HAMAX_SINCE" 2>/dev/null)
    offgrid=false

    if [ -n "$RADIO" ]; then
        role=$(hamax_role "$RADIO")
        radio_band=$(uci -q get "wireless.${RADIO}.band")
        chan=$(uci -q get "wireless.${RADIO}.channel")
        htmode=$(uci -q get "wireless.${RADIO}.htmode")

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
  "radio": "$(hamax_json_escape "${RADIO:-}")",
  "band": "$(hamax_json_escape "${radio_band:-}")",
  "channel": "$(hamax_json_escape "${chan:-}")",
  "htmode": "$(hamax_json_escape "${htmode:-}")",
  "freq": "$(hamax_json_escape "${cur_freq:-}")",
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
