# =====================================================================
# HAMax Module: UCI Backup/Restore Engine, Protocol Lock & Radio Apply
# =====================================================================

# ---------------------------------------------------------------------
hamax_backup_init() {
    mkdir -p "$HAMAX_DIR"
    [ -f "$HAMAX_BACKUP" ] || : > "$HAMAX_BACKUP"
}

hamax_set() {
    local key="$1" val="$2" old

    if ! grep -q "^O:${key}=" "$HAMAX_BACKUP" 2>/dev/null; then
        old=$(uci -q get "$key")
        if [ -n "$old" ]; then
            echo "O:${key}=${old}" >> "$HAMAX_BACKUP"
        else
            echo "O:${key}=@@UNSET@@" >> "$HAMAX_BACKUP"
        fi
    fi

    uci -q set "${key}=${val}"
}

hamax_del() {
    local key="$1" old

    if ! grep -q "^O:${key}=" "$HAMAX_BACKUP" 2>/dev/null; then
        old=$(uci -q get "$key")
        if [ -n "$old" ]; then
            echo "O:${key}=${old}" >> "$HAMAX_BACKUP"
        else
            echo "O:${key}=@@UNSET@@" >> "$HAMAX_BACKUP"
        fi
    fi

    uci -q delete "$key" 2>/dev/null
}

# Values in these lists (rates in kbps, "key=value" hostapd directives)
# never contain whitespace, so a space-joined round trip is lossless.
hamax_set_list() {
    local key="$1" old v
    shift

    if ! grep -q "^L:${key}=" "$HAMAX_BACKUP" 2>/dev/null; then
        old=$(uci -q get "$key")
        if [ -n "$old" ]; then
            echo "L:${key}=${old}" >> "$HAMAX_BACKUP"
        else
            echo "L:${key}=@@UNSET@@" >> "$HAMAX_BACKUP"
        fi
    fi

    uci -q delete "$key" 2>/dev/null
    for v in "$@"; do
        uci -q add_list "${key}=${v}"
    done
}

# ---------------------------------------------------------------------
# kernel buffer scaling & Candela Technologies CT optimizations
# ---------------------------------------------------------------------
HAMAX_SYSCTL_BACKUP="$HAMAX_DIR/sysctl.backup"

hamax_apply_sysctl() {
    mkdir -p "$HAMAX_DIR"
    if [ ! -f "$HAMAX_SYSCTL_BACKUP" ]; then
        {
            echo "net.core.rmem_max=$(sysctl -n net.core.rmem_max 2>/dev/null)"
            echo "net.core.wmem_max=$(sysctl -n net.core.wmem_max 2>/dev/null)"
            echo "net.core.netdev_max_backlog=$(sysctl -n net.core.netdev_max_backlog 2>/dev/null)"
        } > "$HAMAX_SYSCTL_BACKUP"
    fi

    sysctl -q -w net.core.rmem_max=4194304 2>/dev/null
    sysctl -q -w net.core.wmem_max=4194304 2>/dev/null
    sysctl -q -w net.core.netdev_max_backlog=5000 2>/dev/null
    hamax_log "scaled kernel socket buffers (4MB) and netdev backlog (5000) for high-speed aggregated wireless"
}

hamax_restore_sysctl() {
    if [ -f "$HAMAX_SYSCTL_BACKUP" ]; then
        local k v
        while IFS='=' read -r k v; do
            [ -n "$k" ] && [ -n "$v" ] && sysctl -q -w "${k}=${v}" 2>/dev/null
        done < "$HAMAX_SYSCTL_BACKUP"
        rm -f "$HAMAX_SYSCTL_BACKUP"
        hamax_log "restored original kernel socket buffers and backlog"
    fi
}

hamax_apply_ct_tuning() {
    local radio="$1" phy ct_special
    phy=$(hamax_phy_for_radio "$radio" 2>/dev/null)
    [ -n "$phy" ] || phy="$HAMAX_PHY"
    if [ -n "$phy" ]; then
        ct_special="/sys/kernel/debug/ieee80211/${phy}/ath10k/ct_special"
        if [ -w "$ct_special" ]; then
            # Candela Technologies CT flag 0x100100000000 suppresses aggressive station kickout
            echo "0x100100000000" > "$ct_special" 2>/dev/null && \
                hamax_log "applied Candela Technologies firmware link stability flags to ${phy}"
        fi
    fi
}

hamax_restore() {
    local line key val v

    hamax_restore_sysctl

    if [ -f "$HAMAX_BACKUP" ]; then
        while IFS= read -r line; do
            case "$line" in
                O:*)
                    line="${line#O:}"
                    key="${line%%=*}"
                    val="${line#*=}"
                    [ -n "$key" ] || continue
                    if [ "$val" = "@@UNSET@@" ]; then
                        uci -q delete "$key" 2>/dev/null
                    else
                        uci -q set "${key}=${val}"
                    fi
                    ;;
                L:*)
                    line="${line#L:}"
                    key="${line%%=*}"
                    val="${line#*=}"
                    [ -n "$key" ] || continue
                    uci -q delete "$key" 2>/dev/null
                    if [ "$val" != "@@UNSET@@" ]; then
                        for v in $val; do
                            uci -q add_list "${key}=${v}"
                        done
                    fi
                    ;;
            esac
        done < "$HAMAX_BACKUP"
        rm -f "$HAMAX_BACKUP"
        hamax_log "restored the 5 GHz radio from backup configuration"
    else
        hamax_log "no backup file found; restoring standard 802.11 defaults on 5 GHz radio"
        for iface in $(hamax_ifaces_on_radio "$RADIO"); do
            uci -q delete "wireless.${iface}.hidden"
            uci -q delete "wireless.${iface}.hostapd_options"
            uci -q delete "wireless.${iface}.disassoc_low_ack"
            uci -q delete "wireless.${iface}.basic_rate"
            uci -q delete "wireless.${iface}.multicast_to_unicast"
            local cur_key
            cur_key=$(uci -q get "wireless.${iface}.key")
            if [ "$cur_key" = "$LOCK_KEY" ]; then
                uci -q set "wireless.${iface}.encryption=none"
                uci -q delete "wireless.${iface}.key"
            fi
        done
        uci -q delete "wireless.${RADIO}.distance"
        uci -q delete "wireless.${RADIO}.noscan"
        uci -q delete "wireless.${RADIO}.rts"
        uci -q delete "wireless.${RADIO}.antenna_gain"
    fi

    uci commit wireless
    hamax_log "restored the 5 GHz radio to its standard 802.11 configuration - any normal device can connect"
}

# ---------------------------------------------------------------------
# apply
# ---------------------------------------------------------------------
hamax_apply_radio() {
    local radio="$1"

    hamax_set "wireless.${radio}.distance" "$DISTANCE"
    hamax_set "wireless.${radio}.beacon_int" "$BEACON_INT"

    if [ "$NOSCAN" = "1" ]; then
        hamax_set "wireless.${radio}.noscan" "1"
    fi

    # rts=0 means "leave RTS/CTS alone"; a PtP link has no hidden node.
    if [ "${RTS:-0}" -gt 0 ] 2>/dev/null; then
        hamax_set "wireless.${radio}.rts" "$RTS"
    else
        hamax_del "wireless.${radio}.rts"
    fi

    if [ "$SHORT_GI" = "1" ]; then
        hamax_set "wireless.${radio}.short_gi_20" "1"
        hamax_set "wireless.${radio}.short_gi_40" "1"
        hamax_set "wireless.${radio}.short_gi_80" "1"
    fi

    # OFDM only. cell_density 0 stops OpenWrt from second-guessing the
    # basic rate set we install below.
    if [ "$LEGACY_OFF" = "1" ]; then
        hamax_set "wireless.${radio}.legacy_rates" "0"
        hamax_set "wireless.${radio}.cell_density" "0"
    fi

    [ -n "$TXPOWER" ] && hamax_set "wireless.${radio}.txpower" "$TXPOWER"
    [ -n "$ANTENNA_GAIN" ] && hamax_set "wireless.${radio}.antenna_gain" "$ANTENNA_GAIN"

    hamax_apply_channel "$radio"

    if [ "$TUNE_BUFFERS" = "1" ]; then
        hamax_apply_sysctl
    fi

    if [ "$CT_SUPPRESS_KICK" = "1" ]; then
        hamax_apply_ct_tuning "$radio"
    fi

    # country and country_ie stay untouched: they are the operator's
    # regulatory decision, and country_ie=0 is already set in the shipped
    # wireless config so clients cannot push their home channel mask
    # onto this link.
}

# Channel selection across the unlocked 10 MHz-spaced plan. Left alone
# entirely when hamax.settings.channel is empty, so an operator who has
# already pinned a channel in /etc/config/wireless keeps it.
hamax_apply_channel() {
    local radio="$1" freq

    [ -n "$CHANNEL" ] || return 0

    case " $HAMAX_CHANS " in
        *" $CHANNEL "*) ;;
        *)
            hamax_log "WARNING: channel $CHANNEL is not in the HAMax plan; leaving the radio's channel alone"
            return 0
            ;;
    esac

    case "$(hamax_chan_state "$CHANNEL")" in
        unavailable)
            hamax_log "WARNING: the driver does not offer channel $CHANNEL (superchannel patches missing, or the regulatory database is blocking it); leaving the radio's channel alone"
            return 0
            ;;
        unknown)
            hamax_log "NOTE: could not read the phy to confirm channel $CHANNEL exists; applying it anyway"
            ;;
    esac

    freq=$(hamax_chan_freq "$CHANNEL")

    if hamax_chan_is_standard "$CHANNEL"; then
        hamax_log "channel $CHANNEL (${freq} MHz) is a standard 802.11 centre - stock clients CAN see this network"
        [ "$STEALTH" = "1" ] &&
            hamax_log "WARNING: stealth is on but channel $CHANNEL is on-grid; pick an off-grid channel or stealth only hides the SSID name"
    else
        hamax_log "channel $CHANNEL (${freq} MHz) is off-grid - stock clients do not scan this centre frequency"
    fi

    hamax_set "wireless.${radio}.channel" "$CHANNEL"
    [ -n "$HTMODE" ] && hamax_set "wireless.${radio}.htmode" "$HTMODE"
}

hamax_apply_iface() {
    local iface="$1" role="$2" imode ie

    imode=$(uci -q get "wireless.${iface}.mode")

    [ "$WDS" = "1" ] && hamax_set "wireless.${iface}.wds" "1"

    if [ "$MCAST_TO_UCAST" = "1" ]; then
        hamax_set "wireless.${iface}.multicast_to_unicast" "1"
    else
        hamax_del "wireless.${iface}.multicast_to_unicast"
    fi

    hamax_set "wireless.${iface}.mcast_rate" "$MCAST_RATE"

    if [ "$LEGACY_OFF" = "1" ]; then
        if [ "$PROFILE" = "ptp" ]; then
            hamax_set_list "wireless.${iface}.basic_rate" 54000
        else
            hamax_set_list "wireless.${iface}.basic_rate" 24000 54000
        fi
    fi

    if [ "$imode" = "sta" ] && [ "$ISOLATION" = "1" ]; then
        hamax_log "configuring Station CPE with HAMax protocol lock key"
        hamax_set "wireless.${iface}.encryption" "psk2"
        hamax_set "wireless.${iface}.key" "$LOCK_KEY"
    fi

    # Everything below is hostapd-side and only exists on an AP.
    [ "$imode" = "ap" ] || return 0

    hamax_set "wireless.${iface}.dtim_period" "$DTIM"

    # A fixed CPE on a tower should not be dropped for a few missed
    # ACKs, and it has no battery to save.
    hamax_set "wireless.${iface}.disassoc_low_ack" "0"

    # HAMax Exclusive Isolation & Stealth:
    # 1. Hide SSID so standard Wi-Fi scans cannot see the network.
    # 2. Lock with WPA2-PSK protocol key so non-HAMax devices cannot associate.
    if [ "$ISOLATION" = "1" ]; then
        hamax_log "enforcing HAMax protocol isolation lock (hidden SSID + WPA2-PSK lock key)"
        hamax_set "wireless.${iface}.hidden" "1"
        hamax_set "wireless.${iface}.encryption" "psk2"
        hamax_set "wireless.${iface}.key" "$LOCK_KEY"
    elif [ "$STEALTH" = "1" ]; then
        hamax_set "wireless.${iface}.hidden" "1"
    fi

    set --

    if [ "$VENDOR_IE" = "1" ] && [ "$CAP_VENDOR_IE" = "1" ]; then
        [ "$role" = "client" ] && ie="$HAMAX_IE_STA" || ie="$HAMAX_IE_AP"
        set -- "$@" "vendor_elements=${ie}"
    fi

    if [ "$ATF" = "1" ] && [ "$CAP_AIRTIME" = "1" ]; then
        set -- "$@" "airtime_mode=${ATF_MODE}" \
                    "airtime_update_interval=${ATF_UPDATE}" \
                    "airtime_bss_weight=1"
    fi

    set -- "$@" "uapsd_advertisement_enabled=0"

    hamax_set_list "wireless.${iface}.hostapd_options" "$@"
}

# Reloads only the 5 GHz radio. netifd brings that one wifi-device down
# and back up; the 2.4 GHz radio keeps running.
hamax_reload_radio() {
    local radio="$1"

    uci commit wireless

    if [ -x /sbin/wifi ]; then
        /sbin/wifi up "$radio" >/dev/null 2>&1 && {
            hamax_log "reloaded $radio (5 GHz) to apply the new configuration"
            return 0
        }
    fi

    ubus call network.wireless down "{\"device\":\"$radio\"}" >/dev/null 2>&1
    ubus call network.wireless up   "{\"device\":\"$radio\"}" >/dev/null 2>&1
    hamax_log "reloaded $radio (5 GHz) via ubus"
}
