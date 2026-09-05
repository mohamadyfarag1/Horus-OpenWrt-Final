# =====================================================================
# HAMax Module: 162-Channel Spectrum Plan (5 MHz Step), Frequency Math & PHY State
# =====================================================================

# ---------------------------------------------------------------------
# 5 GHz channel plan
#
# The superchannel patches register a 5 MHz-spaced table in
# ath10k_5ghz_channels[]; this list must stay in step with CHANS in
# scripts/gen_package_patches.py. freq = 5000 + 5 * channel, so the plan
# spans 5120 - 5925 MHz (162 channels matching Ubiquiti resolution).
# ---------------------------------------------------------------------
HAMAX_CHANS="24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 43 44 45 46 47 48 49 50 51 52 53 54 55 56 57 58 59 60 61 62 63 64 65 66 67 68 69 70 71 72 73 74 75 76 77 78 79 80 81 82 83 84 85 86 87 88 89 90 91 92 93 94 95 96 97 98 99 100 101 102 103 104 105 106 107 108 109 110 111 112 113 114 115 116 117 118 119 120 121 122 123 124 125 126 127 128 129 130 131 132 133 134 135 136 137 138 139 140 141 142 143 144 145 146 147 148 149 150 151 152 153 154 155 156 157 158 159 160 161 162 163 164 165 166 167 168 169 170 171 172 173 174 175 176 177 178 179 180 181 182 183 184 185"

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
    echo $((5000 + 5 * $1))
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
    local info

    HAMAX_PHY=$(hamax_phy_for_radio "$RADIO" 2>/dev/null)
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
