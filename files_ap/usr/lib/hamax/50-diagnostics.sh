# =====================================================================
# HAMax Module: Diagnostics, Verification (check/verify) & Actions
# =====================================================================

# ---------------------------------------------------------------------
# commands
# ---------------------------------------------------------------------
hamax_require_radio() {
    if [ -z "$RADIO" ]; then
        hamax_log "ERROR: no 5 GHz radio found in /etc/config/wireless - HAMax does nothing"
        return 1
    fi
    return 0
}

hamax_enable() {
    local role iface

    hamax_require_radio || return 1

    role=$(hamax_role "$RADIO")

    hamax_log "=========================================================="
    hamax_log "enabling HAMax on $RADIO (5 GHz) - role=$role profile=$PROFILE"
    hamax_log "2.4 GHz radio is not touched"

    if [ "$CAP_AIRTIME" != "1" ]; then
        hamax_log "NOTE: this hostapd build has no airtime policy support; airtime fairness is skipped"
    elif [ "$CAP_ATF_KERNEL" != "1" ]; then
        hamax_log "NOTE: mac80211 airtime scheduler not detected; airtime weights may have no effect"
    fi
    [ "$CAP_VENDOR_IE" = "1" ] || hamax_log "NOTE: hostapd has no vendor_elements support; the HAMax IE is skipped"

    hamax_backup_init
    hamax_apply_radio "$RADIO"

    for iface in $(hamax_ifaces_on_radio "$RADIO"); do
        hamax_apply_iface "$iface" "$role"
        hamax_log "configured interface $iface"
    done

    hamax_reload_radio "$RADIO"

    mkdir -p "$HAMAX_DIR"
    date '+%Y-%m-%d %H:%M:%S' > "$HAMAX_SINCE"

    # netifd returns as soon as it has asked the radio to come up, not
    # when the phy is actually beaconing. Writing telemetry immediately
    # captures a radio with no interfaces and no stations, which then
    # sits in the UI as "0 clients" until the next poll. Give the phy a
    # moment, and invalidate the cached phy info so the new channel is
    # read rather than the pre-reload one.
    sleep 3
    HAMAX_PHY_READ=0
    hamax_load_phy || true

    hamax_write_json
    hamax_log "HAMax enabled"
}

hamax_disable() {
    hamax_log "disabling HAMax - restoring the 5 GHz radio"

    hamax_restore

    if [ -n "$RADIO" ]; then
        hamax_reload_radio "$RADIO"
    fi

    rm -f "$HAMAX_SINCE"
    hamax_write_json
    hamax_log "HAMax disabled"
}

hamax_check() {
    echo "HAMax capability report"
    echo "======================="
    echo "5 GHz radio          : ${RADIO:-NOT FOUND}"
    if [ -n "$RADIO" ]; then
        echo "  band               : $(uci -q get "wireless.${RADIO}.band")"
        echo "  channel            : $(uci -q get "wireless.${RADIO}.channel")"
        echo "  htmode             : $(uci -q get "wireless.${RADIO}.htmode")"
        echo "  detected role      : $(hamax_role "$RADIO")"
        echo "  interfaces         : $(hamax_ifaces_on_radio "$RADIO" | tr '\n' ' ')"
        echo "  live netdevs       : $(hamax_live_ifnames "$RADIO" | tr '\n' ' ')"
    fi
    echo
    echo "hostapd airtime policy : $([ "$CAP_AIRTIME" = "1" ] && echo "supported" || echo "NOT SUPPORTED (needs full wpad)")"
    echo "mac80211 airtime sched : $([ "$CAP_ATF_KERNEL" = "1" ] && echo "detected" || echo "not detected")"
    echo "hostapd vendor_elements: $([ "$CAP_VENDOR_IE" = "1" ] && echo "supported" || echo "NOT SUPPORTED")"
    echo "ath10k-ct driver/fw    : $([ "$CAP_ATH10K_CT" = "1" ] && echo "detected" || echo "standard ath10k / not detected")"
    echo "multicast to unicast   : $([ "$MCAST_TO_UCAST" = "1" ] && echo "enabled (lowers latency, 0% ARP loss)" || echo "disabled")"
    echo "kernel buffer scaling  : $([ "$TUNE_BUFFERS" = "1" ] && echo "enabled (4MB socket buffers, 5000 backlog)" || echo "disabled")"
    echo
    echo "backup file            : $([ -f "$HAMAX_BACKUP" ] && echo "$HAMAX_BACKUP ($(wc -l < "$HAMAX_BACKUP") entries)" || echo "none (HAMax not applied)")"

    local c total=0 ok=0 no=0 unk=0 off=0 offok=0
    for c in $HAMAX_CHANS; do
        total=$((total + 1))
        hamax_chan_state_var "$c"
        hamax_chan_is_standard "$c" || off=$((off + 1))
        case "$CHAN_STATE" in
            usable)      ok=$((ok + 1))
                         hamax_chan_is_standard "$c" || offok=$((offok + 1)) ;;
            unavailable) no=$((no + 1)) ;;
            *)           unk=$((unk + 1)) ;;
        esac
    done

    echo
    echo "channel plan           : $total channels (5180 - 5885 MHz, 10 MHz spacing)"
    if [ "$unk" = "$total" ]; then
        echo "  driver check         : COULD NOT READ THE PHY - none of the counts below are verified"
    else
        echo "  offered by driver    : $ok"
        [ "$no" -gt 0 ] && echo "  NOT offered          : $no  <- superchannel patches are probably missing from this image"
        [ "$unk" -gt 0 ] && echo "  unknown              : $unk"
    fi
    echo "  off-grid (stealth)   : $off in plan, $offok confirmed usable"
    echo "  a stock client scans only the $(echo $HAMAX_STD_CHANS | wc -w) standard centres;"
    echo "  the other $off are invisible to it because it never tunes there."
}

# Is HAMax actually in effect right now?
#
# Everything here is read back from the LIVE system - the running phy,
# the netdev, the survey, and the hostapd config file netifd generated -
# never from /etc/config. A setting can be present in UCI and absent on
# the radio (hostapd refused it, the driver ignored it, the radio never
# reloaded), and that gap is exactly what this command exists to expose.
hamax_verify() {
    local ifname info conf found first_if="" line

    echo "HAMax live verification"
    echo "======================="

    if [ -z "$RADIO" ]; then
        echo "no 5 GHz radio - nothing to verify"
        return 1
    fi

    echo "profile enabled in UCI : $([ "$ENABLED" = "1" ] && echo yes || echo no)"
    echo "backup present         : $([ -f "$HAMAX_BACKUP" ] && echo "yes (profile applied)" || echo "no (profile NOT applied)")"
    echo

    for ifname in $(hamax_live_ifnames "$RADIO"); do
        [ -n "$first_if" ] || first_if="$ifname"
        info=$(iw dev "$ifname" info 2>/dev/null)
        [ -n "$info" ] || continue

        echo "--- $ifname ---"
        printf '  type / channel       : %s\n' \
            "$(printf '%s\n' "$info" | awk '/^\ttype/{t=$2} /^\tchannel/{sub(/^\tchannel /,""); c=$0} END{print t "  " c}')"
        printf '  txpower              : %s\n' \
            "$(printf '%s\n' "$info" | awk '/txpower/{print $2 " " $3}')"

        # 4-address (WDS) shows on the netdev itself
        if [ -n "$(printf '%s\n' "$info" | grep -i '4addr')" ]; then
            printf '  4addr (WDS)          : %s\n' \
                "$(printf '%s\n' "$info" | awk '/4addr/{print $2}')"
        fi
        echo
    done

    echo "--- kernel buffers & network queues ---"
    printf '  rmem_max             : %s bytes\n' "$(sysctl -n net.core.rmem_max 2>/dev/null)"
    printf '  wmem_max             : %s bytes\n' "$(sysctl -n net.core.wmem_max 2>/dev/null)"
    printf '  netdev_max_backlog   : %s\n' "$(sysctl -n net.core.netdev_max_backlog 2>/dev/null)"
    echo

    if [ -n "$first_if" ]; then
        set -- $(hamax_survey_raw "$first_if")
        if [ -n "$1" ]; then
            echo "--- radio survey (channel in use) ---"
            echo "  frequency            : $1 MHz"
            echo "  noise floor          : ${2:-n/a} dBm"
            if [ -n "$3" ] && [ -n "$4" ] && [ "$3" -gt 0 ] 2>/dev/null; then
                echo "  channel utilisation  : $(($4 * 100 / $3))%  (busy $4 ms of $3 ms)"
            fi
            echo
        fi
    fi

    # hostapd's generated config is the ground truth for whether our
    # directives were accepted: if hostapd is running, it parsed this
    # file without choking on them.
    conf=$(ls /var/run/hostapd-phy*.conf /var/run/hostapd/*.conf 2>/dev/null | head -1)
    if [ -n "$conf" ] && [ -r "$conf" ]; then
        echo "--- hostapd config in use ($conf) ---"
        for line in vendor_elements airtime_mode airtime_update_interval \
                    ignore_broadcast_ssid wds_sta dtim_period basic_rates \
                    uapsd_advertisement_enabled; do
            found=$(grep -m1 "^${line}=" "$conf" 2>/dev/null)
            if [ -n "$found" ]; then
                echo "  ✓ $found"
            else
                echo "  · $line: not present"
            fi
        done
        echo
    else
        echo "--- hostapd config not readable (station mode, or hostapd not running) ---"
        echo
    fi

    # An airtime weight on a station is proof the airtime scheduler is
    # live: mac80211 only reports it when the policy is actually running.
    if [ -n "$first_if" ]; then
        found=$(iw dev "$first_if" station dump 2>/dev/null | grep -c 'airtime weight')
        echo "--- airtime fairness ---"
        if [ "${found:-0}" -gt 0 ]; then
            echo "  ✓ mac80211 reports airtime weights for $found station(s) - the scheduler is live"
        else
            echo "  · no airtime weights reported (no stations, or the policy is not active)"
        fi
    fi
}

hamax_status() {
    hamax_write_json
    cat "$HAMAX_JSON"
}
