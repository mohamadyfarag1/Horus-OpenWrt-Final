# =====================================================================
# HAMax Module: 68-Channel Spectrum Plan, Frequency Math & PHY State
# =====================================================================

# ---------------------------------------------------------------------
# 5 GHz channel plan: channels 20..220 = 5120 - 6100 MHz in 5 MHz steps,
# matching ath10k_5ghz_channels[] (see scripts/gen_package_patches.py).
#
# This used to start at 36, on the theory that IPQ4019 BDF calibration data
# begins at 5180 MHz and anything below drops TX power to 0 dBm. That is not
# what the hardware reports: `iw phy phy1 info` lists 30.0 dBm from 5120 MHz
# up, and the firmware's own TPC table has real calibration at 5150 MHz
# (power limit 20 dBm, regulatory max 33 dBm). The channels below 36 were
# fine; what actually failed was the 80 MHz centre calculation in
# mac80211.sh, which asked for sub-channels below the bottom of the band.
#
# 5120 MHz (ch 24) needs the regulatory floor at or below 5110 MHz - see
# scripts/09-generate-regdb.sh - or cfg80211 disables it for not fitting a
# 20 MHz slot.
# ---------------------------------------------------------------------
HAMAX_CHANS="$(seq 24 220)"

# The 20 MHz centres a stock 802.11 client actually tunes to when it
# scans. Anything outside this set is off-grid: a phone or laptop never
# parks its receiver there, so it never hears the beacon and the network
# does not appear in its list at all.
#
# This is the one airMAX-like invisibility mechanism that is genuinely
# reproducible here. airMAX also uses non-standard channel WIDTHS
# (10/30/50/60 MHz) for the same effect, but ath10k has no 5/10 MHz
# support, so width is not a lever on this hardware - only the centre is.
HAMAX_STD_CHANS="36 40 44 48 52 56 60 64 100 104 108 112 116 120 124 128 132 136 140 144 149 153 157 161 165"

hamax_chan_freq() {
    local ch="$1"
    case "$ch" in
        ''|*[!0-9-]*) echo ""; return 1 ;;
    esac
    if [ "$ch" -ge 1 ] 2>/dev/null && [ "$ch" -le 14 ] 2>/dev/null; then
        if [ "$ch" -eq 14 ]; then
            echo 2484
        else
            echo $((2407 + 5 * ch))
        fi
    elif [ "$ch" -ge 24 ] 2>/dev/null; then
        echo $((5000 + 5 * ch))
    else
        echo ""
    fi
}

# 0 = off-grid (invisible to stock clients), 1 = standard centre
hamax_chan_is_standard() {
    case " $HAMAX_STD_CHANS " in
        *" $1 "*) return 0 ;;
    esac
    return 1
}

# What the running driver says about a channel. Three states, because
# "we could not ask" is not the same answer as "the driver does not have
# it" - collapsing the two would report a stock 25-channel image as a
# full 68-channel one.
#
#   usable      the phy lists it and it is not disabled
#   unavailable the phy was read and the channel is absent or disabled
#   unknown     the phy could not be resolved or iw is unavailable
# Sets CHAN_STATE rather than printing, so callers in a loop do not pay
# a fork per channel. hamax_chan_state() is the printing wrapper for the
# handful of single-channel callers.
hamax_chan_state_var() {
    if [ "$HAMAX_PHY_READ" != "1" ]; then
        CHAN_STATE="unknown"
        return
    fi
    case " $HAMAX_USABLE_CHANS " in
        *" $1 "*) CHAN_STATE="usable" ;;
        *)        CHAN_STATE="unavailable" ;;
    esac
}

hamax_chan_state() {
    hamax_chan_state_var "$1"
    echo "$CHAN_STATE"
}

# The phy is read exactly once per run, in the entry point, and the set
# of enabled channels is extracted in a single awk pass. Doing it
# per-channel meant 68 greps for one `channels` call, which is slow
# enough to matter on a 717 MHz SoC and slow enough to time out a test
# harness. Loading eagerly also means every command substitution below
# inherits the result instead of re-deriving it in its own subshell.
HAMAX_PHY=""
HAMAX_USABLE_CHANS=""
HAMAX_PHY_READ=0

hamax_load_phy() {
    local info r

    HAMAX_PHY=""
    for r in $RADIO; do
        HAMAX_PHY=$(hamax_phy_for_radio "$r" 2>/dev/null)
        [ -n "$HAMAX_PHY" ] && break
    done
    [ -n "$HAMAX_PHY" ] || return 1

    info=$(iw phy "$HAMAX_PHY" info 2>/dev/null)
    [ -n "$info" ] || return 1

    # Lines look like:  * 5730.0 MHz [146] (30.0 dBm)
    # and carry "(disabled)" when the channel is registered but unusable.
    HAMAX_USABLE_CHANS=$(printf '%s\n' "$info" | awk '
        match($0, /\[[0-9]+\]/) {
            if ($0 !~ /disabled/)
                printf "%s ", substr($0, RSTART + 1, RLENGTH - 2)
        }')
    HAMAX_PHY_READ=1
    return 0
}
