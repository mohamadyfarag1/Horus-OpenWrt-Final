# Horus wireless helpers.
#
# Everything in this file is Horus-owned. The stock OpenWrt scripts
# (/lib/netifd/hostapd.sh, /lib/netifd/wireless/mac80211.sh) source this and
# call into it, so that they stay as close to upstream as possible and can be
# diffed against a new OpenWrt release without hunting for our edits.
#
# Sourced, never executed. Assumes /lib/functions.sh and the netifd JSON
# helpers are already loaded by the caller.

[ -n "$HORUS_WIRELESS_SH" ] && return 0
HORUS_WIRELESS_SH=1

[ -r /lib/netifd/horus-5g-bounds ] && . /lib/netifd/horus-5g-bounds

# Fallbacks, in case the bounds file is missing from the image. Keep in sync
# with horus-5g-bounds; that file is the source of truth.
: "${HORUS_5G_MIN_CHAN:=24}"
: "${HORUS_5G_MAX_CHAN:=200}"
: "${HORUS_5G_MIN_FREQ:=5100}"
: "${HORUS_5G_MAX_FREQ:=6000}"
: "${HORUS_2G_MIN_FREQ:=2312}"
: "${HORUS_2G_MAX_FREQ:=2682}"
: "${HORUS_FREQ_SANE_MIN:=2300}"
: "${HORUS_FREQ_SANE_MAX:=6000}"

# Ubiquiti airMAX vendor IE (OUI 00:27:22). Advertised in beacons, probe
# responses and association requests so Rocket AC / airMAX peers recognise us.
HORUS_AIRMAX_IE="dd080027220002040608"


# ---------------------------------------------------------------------------
# Config reading
# ---------------------------------------------------------------------------

# horus_json_get_list <dest_var> <field>
#
# Read a config field that may be either a uci `list` (JSON array) or a plain
# `option` (JSON string), yielding a space-separated string either way.
#
# json_get_vars/json_get_var only handle scalars. Used on a field declared with
# config_add_array they set the variable to the empty string - which is why
# `list freq_list ...` silently did nothing, and why reading scan_list with
# json_get_vars clobbered the value the wireless device script had already put
# in that same variable.
horus_json_get_list() {
	local _dest="$1" _field="$2" _type= _val=
	json_get_type _type "$_field"
	case "$_type" in
		array)  json_get_values _val "$_field" ;;
		string) json_get_var _val "$_field" ;;
	esac
	eval "$_dest=\"\$_val\""
}

# horus_freq_list_sanitize <dest_var> <value>...
#
# Keep only plain MHz values.
#
# wpa_supplicant reads freq_list/scan_freq in MHz; a channel number there
# becomes a frequency nobody transmits on and the station never associates.
# We refuse to guess: in the Horus plan channels 24..59 exist in BOTH the
# 2.4 GHz upper band (2557..2732 MHz) and the 5 GHz table (5100..5295 MHz),
# so "44" is ambiguous and any conversion would be a coin flip.
horus_freq_list_sanitize() {
	local _dest="$1"; shift
	local _out= _f=
	for _f in "$@"; do
		case "$_f" in
			""|*[!0-9]*) continue ;;
		esac
		if [ "$_f" -ge "$HORUS_FREQ_SANE_MIN" ] && [ "$_f" -le "$HORUS_FREQ_SANE_MAX" ]; then
			_out="${_out:+$_out }$_f"
		else
			echo "horus: ignoring \"$_f\" in freq_list - expected MHz ($HORUS_FREQ_SANE_MIN-$HORUS_FREQ_SANE_MAX)" >&2
		fi
	done
	eval "$_dest=\"\$_out\""
}


# ---------------------------------------------------------------------------
# Station scan frequencies
# ---------------------------------------------------------------------------

# horus_default_freq_list <dest_var> <band> <freq>
#
# The frequency sweep a station uses when the config names none. Covers the
# whole SuperChannel plan at 5 MHz spacing so the station can discover an AP
# on ANY channel, standard or not.
#
# Without this wpa_supplicant asks the driver for a full-band scan of every
# registered channel; on the SuperChannel plan that is 253 channels, slow
# enough that the AP ages out of the scan cache before the sweep comes back.
# Naming the frequencies explicitly also keeps the WMI_START_SCAN payload
# bounded (177 channels x 4 bytes = 708 B, well inside the 2048 B CE3 limit).
horus_default_freq_list() {
	local _dest="$1" _band="$2" _freq="$3" _out=

	if [ "$_band" = "5g" ]; then
		_out="$(seq "$HORUS_5G_MIN_FREQ" 5 "$HORUS_5G_MAX_FREQ")"
	elif [ "$_band" = "2g" ]; then
		_out="$(seq "$HORUS_2G_MIN_FREQ" 5 "$HORUS_2G_MAX_FREQ")"
	elif [ -n "$_freq" ] && [ "$_freq" -ge 5000 ] 2>/dev/null; then
		_out="$(seq "$HORUS_5G_MIN_FREQ" 5 "$HORUS_5G_MAX_FREQ")"
	elif [ -n "$_freq" ] && [ "$_freq" -lt 3000 ] 2>/dev/null; then
		_out="$(seq "$HORUS_2G_MIN_FREQ" 5 "$HORUS_2G_MAX_FREQ")"
	elif [ -n "$_freq" ]; then
		_out="$_freq"
	else
		_out="$(seq "$HORUS_5G_MIN_FREQ" 5 "$HORUS_5G_MAX_FREQ")"
	fi

	eval "$_dest=\"\$_out\""
}

# horus_sta_network_freqs <freqs_var> <scanfreq_var> <band> <freq>
#
# Resolve the freq_list / scan_freq pair for a station network block, reading
# scan_list, freq_list and scan_freq out of the current JSON config section.
# Falls back to the full SuperChannel sweep when the config names none.
horus_sta_network_freqs() {
	local _freqs_dest="$1" _sf_dest="$2" _band="$3" _freq="$4"
	local _sl= _sf= _net=

	horus_json_get_list _sl scan_list
	[ -z "$_sl" ] && horus_json_get_list _sl freq_list
	[ -z "$_sl" ] && horus_default_freq_list _sl "$_band" "$_freq"

	horus_json_get_list _sf scan_freq
	horus_freq_list_sanitize _sf $_sf

	_net="${_sl:-$_sf}"
	horus_freq_list_sanitize _net $_net

	eval "$_freqs_dest=\"\$_net\""
	eval "$_sf_dest=\"\$_sf\""
}

# horus_iface_scan_list <dest_var>
#
# The freq_list written into the global (non-network) part of a
# wpa_supplicant.conf. Reads scan_list, then freq_list, then scan_freq.
#
# These go into private variables because reading them with json_get_vars
# into $scan_list overwrote the value the wireless device script had already
# placed there (json_get_var yields an empty string for a config_add_array
# field), so the interface came up with no freq_list at all.
horus_iface_scan_list() {
	local _dest="$1"
	local _h_scan= _h_freq= _h_sfreq= _all=

	horus_json_get_list _h_scan scan_list
	horus_json_get_list _h_freq freq_list
	horus_json_get_list _h_sfreq scan_freq

	_all="${_h_scan:-$scan_list}"
	[ -z "$_all" ] && _all="$_h_freq"
	[ -z "$_all" ] && _all="$_h_sfreq"
	horus_freq_list_sanitize _all $_all

	eval "$_dest=\"\$_all\""
}


# ---------------------------------------------------------------------------
# airMAX / Ubiquiti interoperability
# ---------------------------------------------------------------------------

# horus_airmax_ie <dest_var> [device]
#
# Yield the airMAX vendor IE when this radio should advertise it, empty
# otherwise. Reads airmax / airmax_compat / vendor_elements from the current
# JSON section, then falls back to the radio's uci airmax_compat flag.
#
# An explicit vendor_elements value wins; the IE is appended to it unless it
# already carries the 00:27:22 OUI.
horus_airmax_ie() {
	local _dest="$1" _dev="$2" _out=
	local airmax airmax_compat vendor_elements
	json_get_vars airmax airmax_compat vendor_elements

	local _on=
	if [ "$airmax" = "1" ] || [ "$airmax_compat" = "1" ]; then
		_on=1
	elif [ -n "$_dev" ]; then
		_on=$(uci -q get "wireless.${_dev}.airmax_compat")
	fi

	if [ "$_on" = "1" ]; then
		if [ -n "$vendor_elements" ]; then
			case "$vendor_elements" in
				*002722*) _out="$vendor_elements" ;;
				*)        _out="$vendor_elements $HORUS_AIRMAX_IE" ;;
			esac
		else
			_out="$HORUS_AIRMAX_IE"
		fi
	else
		_out="$vendor_elements"
	fi

	eval "$_dest=\"\$_out\""
}

# horus_airmax_ie_for_vif <dest_var> <vif> <phy>
#
# As horus_airmax_ie, but resolves the radio through the vif's own device
# first and falls back to the phy. Used on the AP/bss_conf path, where
# $_w_device is not in scope.
horus_airmax_ie_for_vif() {
	local _dest="$1" _vif="$2" _phy="$3" _rdev= _out=

	_rdev=$(uci -q get "wireless.${_vif}.device")
	[ -z "$_rdev" ] && _rdev="$_phy"

	horus_airmax_ie _out "$_rdev"
	eval "$_dest=\"\$_out\""
}

# horus_airmax_supplicant_push <ifname> <ie>
#
# Push the vendor IE into a running wpa_supplicant. The config file has no
# vendor_elements knob for station mode, so it has to go in over the control
# socket once the interface is up. Backgrounded: wpa_supplicant is not
# listening yet at the point this is called.
horus_airmax_supplicant_push() {
	local _ifname="$1" _ie="$2"
	[ -n "$_ie" ] || return 0
	(
		sleep 2
		wpa_cli -p /var/run/wpa_supplicant -i "$_ifname" vendor_elem_add 0 "$_ie" 2>/dev/null || true
		wpa_cli -p /var/run/wpa_supplicant -i "$_ifname" vendor_elem_add 11 "$_ie" 2>/dev/null || true
	) &
}


# ---------------------------------------------------------------------------
# WDS / 4-address mode
# ---------------------------------------------------------------------------

# horus_setup_4addr <ifname> <wds> <multi_ap>
#
# A bridged client needs 4-address mode for transparent bridging, so default
# WDS on - but only when the config did not already answer. The stock test
# forced wds=1 even on an explicit "option wds 0", and 4addr against an AP
# that does not speak WDS associates and then passes no data at all: plain
# client mode has to stay reachable.
#
# Echoes the resolved wds value. Never fails the vif.
horus_setup_4addr() {
	local _ifname="$1" _wds="$2" _multi_ap="$3"

	[ -z "$_wds" ] && [ "$_multi_ap" != 1 ] && _wds=1

	if [ "$_wds" = 1 ]; then
		# 4addr only takes effect while the interface is down.
		ip link set dev "$_ifname" down 2>/dev/null
		iw dev "$_ifname" set 4addr on 2>/dev/null || \
			echo "horus: $_ifname does not support 4addr" >&2
		ip link set dev "$_ifname" up 2>/dev/null || true
	fi

	echo "$_wds"
}


# ---------------------------------------------------------------------------
# SuperChannel band-edge clamping
# ---------------------------------------------------------------------------
#
# The stock centre/secondary-channel formulas assume the standard 20 MHz grid,
# where a 40/80 MHz block is always aligned and can never fall off the end of
# the band. On the 5 MHz-spaced SuperChannel plan it can, at BOTH ends, and it
# then asks for sub-channels the driver never registered (e.g. ch 22 =
# 5110 MHz). cfg80211 rejects that chandef and the radio silently drops to
# 20 MHz; hostapd is worse - it rejects the whole channel with "not found from
# the channel list of the current mode" and the AP never comes up (0 dBm).

# horus_clamp_ht40 <dest_var> <ht_capab> <channel> <band>
#
# Flip HT40 direction when the picked secondary would fall outside the plan.
#
# Accepts both the hostapd spelling ("[HT40+]") and the iw spelling ("HT40+"),
# and answers in whichever form it was given: mac80211_hostapd_setup_base()
# builds ht_capab for hostapd.conf, while mac80211_setup_vif() builds the
# argument for `iw ... set channel`. Both need the same clamp.
horus_clamp_ht40() {
	local _dest="$1" _capab="$2" _chan="$3" _band="$4"

	[ "$_band" = "5g" ] && {
		case "$_capab" in
			"[HT40-]")
				[ "$((_chan - 4))" -lt "$HORUS_5G_MIN_CHAN" ] && _capab="[HT40+]"
			;;
			"[HT40+]")
				[ "$((_chan + 4))" -gt "$HORUS_5G_MAX_CHAN" ] && _capab="[HT40-]"
			;;
			"HT40-")
				[ "$((_chan - 4))" -lt "$HORUS_5G_MIN_CHAN" ] && _capab="HT40+"
			;;
			"HT40+")
				[ "$((_chan + 4))" -gt "$HORUS_5G_MAX_CHAN" ] && _capab="HT40-"
			;;
		esac
	}

	eval "$_dest=\"\$_capab\""
}

# horus_clamp_center <dest_var> <idx> <channel> <band> <half_width>
#
# Keep an N MHz block's centre inside the plan. The primary has to stay one of
# the block's sub-channels, so do not clamp idx - pick a different one of the
# legal centres (channel +/- half_width). At the bottom the highest centre
# works, at the top the lowest one does.
#
# half_width is 2 for VHT40 (centre +/- 2) and 6 for VHT80 (centre +/- 6).
horus_clamp_center() {
	local _dest="$1" _idx="$2" _chan="$3" _band="$4" _half="$5"

	[ "$_band" = "5g" ] && {
		[ "$((_idx - _half))" -lt "$HORUS_5G_MIN_CHAN" ] && _idx=$((_chan + _half))
		[ "$((_idx + _half))" -gt "$HORUS_5G_MAX_CHAN" ] && _idx=$((_chan - _half))
	}

	eval "$_dest=\"\$_idx\""
}
