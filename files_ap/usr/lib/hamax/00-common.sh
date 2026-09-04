# =====================================================================
# HAMax Module: Common Constants, Logging, and UCI Configuration
# =====================================================================

HAMAX_DIR="/etc/hamax"
HAMAX_BACKUP="$HAMAX_DIR/backup.uci"
HAMAX_SINCE="$HAMAX_DIR/since"
HAMAX_JSON="/tmp/hamax.json"
HAMAX_LOG="/tmp/hamax.log"
HAMAX_LOG_MAX=400

# Vendor-specific element, IEEE 802.11 clause 9.4.2.26:
#   DD <len> <3-byte OUI> <OUI type> <version> <role>
# OUI 00:07:89 is the same OUI the device carries on its MAC addresses
# (see the factory-OUI normalisation commit), so a HAMax beacon is
# attributable to the same vendor identity as the hardware.
#   len   = 6  (3 OUI + type + version + role)
#   type  = 0x01  HAMax profile
#   ver   = 0x01
#   role  = 0x01 AP, 0x02 station
HAMAX_IE_AP="dd06000789010101"
HAMAX_IE_STA="dd06000789010102"

# ---------------------------------------------------------------------
# logging
# ---------------------------------------------------------------------
hamax_log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$HAMAX_LOG"
    logger -t hamax "$*"
    # keep /tmp from growing without bound on a long-lived AP
    if [ "$(wc -l < "$HAMAX_LOG" 2>/dev/null || echo 0)" -gt "$HAMAX_LOG_MAX" ]; then
        tail -n $((HAMAX_LOG_MAX / 2)) "$HAMAX_LOG" > "${HAMAX_LOG}.tmp" 2>/dev/null &&
            mv "${HAMAX_LOG}.tmp" "$HAMAX_LOG"
    fi
}

# ---------------------------------------------------------------------
# configuration
# ---------------------------------------------------------------------
hamax_read_config() {
    ENABLED=$(uci -q get hamax.settings.enabled);                   ENABLED="${ENABLED:-0}"
    MODE=$(uci -q get hamax.settings.mode);                         MODE="${MODE:-auto}"
    PROFILE=$(uci -q get hamax.settings.profile);                   PROFILE="${PROFILE:-ptmp}"
    RADIO_OVERRIDE=$(uci -q get hamax.settings.radio)
    DISTANCE=$(uci -q get hamax.settings.distance);                 DISTANCE="${DISTANCE:-5000}"
    BEACON_INT=$(uci -q get hamax.settings.beacon_int);             BEACON_INT="${BEACON_INT:-100}"
    DTIM=$(uci -q get hamax.settings.dtim_period);                  DTIM="${DTIM:-1}"
    RTS=$(uci -q get hamax.settings.rts);                           RTS="${RTS:-512}"
    MCAST_RATE=$(uci -q get hamax.settings.mcast_rate);             MCAST_RATE="${MCAST_RATE:-24000}"
    TXPOWER=$(uci -q get hamax.settings.txpower)
    SHORT_GI=$(uci -q get hamax.settings.short_gi);                 SHORT_GI="${SHORT_GI:-1}"
    NOSCAN=$(uci -q get hamax.settings.noscan);                     NOSCAN="${NOSCAN:-1}"
    LEGACY_OFF=$(uci -q get hamax.settings.disable_legacy_rates);   LEGACY_OFF="${LEGACY_OFF:-1}"
    WDS=$(uci -q get hamax.settings.wds);                           WDS="${WDS:-1}"
    ATF=$(uci -q get hamax.settings.airtime);                       ATF="${ATF:-1}"
    ATF_MODE=$(uci -q get hamax.settings.airtime_mode);             ATF_MODE="${ATF_MODE:-2}"
    ATF_UPDATE=$(uci -q get hamax.settings.airtime_update_interval); ATF_UPDATE="${ATF_UPDATE:-200}"
    VENDOR_IE=$(uci -q get hamax.settings.vendor_ie);               VENDOR_IE="${VENDOR_IE:-1}"
    CHANNEL=$(uci -q get hamax.settings.channel)
    HTMODE=$(uci -q get hamax.settings.htmode)
    STEALTH=$(uci -q get hamax.settings.stealth);                   STEALTH="${STEALTH:-0}"
    ISOLATION=$(uci -q get hamax.settings.isolation);               ISOLATION="${ISOLATION:-1}"
    LOCK_KEY=$(uci -q get hamax.settings.lock_key);                 LOCK_KEY="${LOCK_KEY:-HAMax@Horus9200#Link}"

    # A point-to-point backhaul has exactly one peer, so there is no
    # hidden node to protect against and nothing to share airtime with.
    if [ "$PROFILE" = "ptp" ]; then
        RTS="0"
        ATF="0"
    fi
}
