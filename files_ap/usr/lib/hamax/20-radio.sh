# =====================================================================
# HAMax Module: 5GHz Radio Discovery & Hostapd Capability Probing
# =====================================================================

# ---------------------------------------------------------------------
# radio discovery - 5 GHz only
# ---------------------------------------------------------------------
hamax_wifi_devices() {
    uci -q show wireless | sed -n 's/^wireless\.\([^.=]*\)=wifi-device$/\1/p'
}

hamax_wifi_ifaces() {
    uci -q show wireless | sed -n 's/^wireless\.\([^.=]*\)=wifi-iface$/\1/p'
}

# Returns the name of the 5 GHz wifi-device, or nothing if there is none.
# Never returns a 2.4 GHz radio: that is the whole point of the profile.
hamax_find_radio() {
    local dev band hwmode

    if [ -n "$RADIO_OVERRIDE" ]; then
        band=$(uci -q get "wireless.${RADIO_OVERRIDE}.band")
        hwmode=$(uci -q get "wireless.${RADIO_OVERRIDE}.hwmode")
        if [ "$band" = "5g" ] || [ "$hwmode" = "11a" ]; then
            echo "$RADIO_OVERRIDE"
            return 0
        fi
        hamax_log "WARNING: radio override '$RADIO_OVERRIDE' is not a 5 GHz radio, ignoring it"
    fi

    for dev in $(hamax_wifi_devices); do
        band=$(uci -q get "wireless.${dev}.band")
        hwmode=$(uci -q get "wireless.${dev}.hwmode")
        if [ "$band" = "5g" ] || [ "$hwmode" = "11a" ]; then
            echo "$dev"
            return 0
        fi
    done

    return 1
}

hamax_ifaces_on_radio() {
    local radio="$1" s
    for s in $(hamax_wifi_ifaces); do
        [ "$(uci -q get "wireless.${s}.device")" = "$radio" ] && echo "$s"
    done
}

# The configured role is taken from the interface itself, so HAMax tunes
# whatever the device is already set up as instead of restructuring it.
hamax_detect_role() {
    local radio="$1" i m
    for i in $(hamax_ifaces_on_radio "$radio"); do
        m=$(uci -q get "wireless.${i}.mode")
        [ "$m" = "sta" ] && { echo "client"; return 0; }
    done
    echo "ap"
}

hamax_role() {
    local radio="$1"
    case "$MODE" in
        ap|client) echo "$MODE" ;;
        *)         hamax_detect_role "$radio" ;;
    esac
}

# Live netdev names belonging to the 5 GHz radio, via netifd, so we
# never report or touch an interface that lives on the 2.4 GHz phy.
hamax_live_ifnames() {
    local radio="$1" out

    out=$(ubus call network.wireless status 2>/dev/null |
          jsonfilter -e "@['${radio}'].interfaces[*].ifname" 2>/dev/null)

    if [ -z "$out" ]; then
        # netifd unavailable: fall back to the phy that owns the radio
        local phy
        phy=$(hamax_phy_for_radio "$radio")
        [ -n "$phy" ] && out=$(iw dev 2>/dev/null | awk -v want="$phy" '
            /^phy#/    { cur = "phy" substr($1, 5) }
            $1 == "Interface" { if (cur == want) print $2 }
        ')
    fi

    echo "$out"
}

hamax_phy_for_radio() {
    local radio="$1" path p n ifn

    path=$(uci -q get "wireless.${radio}.path")
    if [ -n "$path" ]; then
        for p in /sys/class/ieee80211/phy*; do
            [ -e "$p" ] || continue
            case "$(readlink -f "$p" 2>/dev/null)" in
                *"$path"*) basename "$p"; return 0 ;;
            esac
        done
    fi

    # Fallback: ask a live interface of this radio which wiphy it is on.
    # Needed when the UCI path does not match the sysfs layout, or when
    # the radio is identified some other way.
    for ifn in $(hamax_live_ifnames "$radio"); do
        n=$(iw dev "$ifn" info 2>/dev/null | awk '$1 == "wiphy" { print $2; exit }')
        [ -n "$n" ] && { echo "phy${n}"; return 0; }
    done

    return 1
}

# ---------------------------------------------------------------------
# capability probing
#
# hostapd aborts on an unknown configuration directive, which would take
# the 5 GHz radio down. So every directive HAMax injects is checked
# against the actual binary first, and skipped (and reported) when the
# build does not carry it.
# ---------------------------------------------------------------------
CAP_AIRTIME=0
CAP_VENDOR_IE=0
CAP_ATF_KERNEL=0
CAP_ATH10K_CT=0

hamax_probe_caps() {
    local bin="" b

    for b in /usr/sbin/hostapd /usr/sbin/wpad; do
        [ -e "$b" ] && { bin="$b"; break; }
    done

    if [ -n "$bin" ]; then
        grep -aq 'airtime_update_interval' "$bin" 2>/dev/null && CAP_AIRTIME=1
        grep -aq 'vendor_elements' "$bin" 2>/dev/null && CAP_VENDOR_IE=1
    fi

    # mac80211 must also carry the airtime scheduler for the hostapd
    # policy to have anything to drive. Check the 5 GHz phy specifically
    # when we know it, since that is the only radio HAMax drives.
    if [ -e /sys/module/mac80211/parameters/airtime_flags ]; then
        CAP_ATF_KERNEL=1
    elif [ -n "$HAMAX_PHY" ] &&
         grep -q 'airtime' "/sys/kernel/debug/ieee80211/${HAMAX_PHY}/aqm" 2>/dev/null; then
        CAP_ATF_KERNEL=1
    fi

    # Candela Technologies CT driver / firmware detection
    if [ -n "$HAMAX_PHY" ] && [ -d "/sys/kernel/debug/ieee80211/${HAMAX_PHY}/ath10k" ]; then
        CAP_ATH10K_CT=1
    elif lsmod 2>/dev/null | grep -q 'ath10k_ct'; then
        CAP_ATH10K_CT=1
    elif [ -d /sys/module/ath10k_ct_core ]; then
        CAP_ATH10K_CT=1
    fi
}

# ---------------------------------------------------------------------
# backup / restore
#
# Nothing is written to /etc/config/wireless before its previous value
# is recorded. "@@UNSET@@" means the option did not exist, so disable
# deletes it rather than inventing a default.
