#!/bin/sh
# =====================================================================
# horus-freq-probe - measure what the radio ACTUALLY does per frequency
#
# Runs ON THE ROUTER. Nothing here needs a rebuild: it only drives uci +
# wifi + iw, and it restores the original channel/htmode when it exits.
#
# WHY THIS EXISTS
# ---------------
# Reading ath10k-ct settles some questions and not the decisive one:
#
#   settled - WMI_SCAN_CHAN_LIST is capped at 2048 bytes by CE3
#             (pci.c src_sz_max), and ce.c only warns before submitting
#             an oversize descriptor, so 248 channels really does corrupt
#             the command. Max is (2048-8-4-4)/24 = 84 channels.
#   settled - struct wmi_scan_chan_list_cmd (WMI 10.4, what IPQ4019 runs)
#             has no flags field, hence no APPEND bit: every send REPLACES
#             the firmware's list. Chunking is not an option.
#   settled - ath10k_vdev_start_restart() passes a fully populated
#             wmi_channel with vdev_start, and ath10k_hw_scan() copies the
#             frequencies mac80211 asked for. Neither consults the list.
#
#   NOT settled - what the closed firmware does with a vdev_start on a
#             frequency that is absent from its regulatory database, or
#             one outside the board's BDF calibration. It may honour the
#             power we hand it, clamp it, or refuse the channel. No source
#             answers this. So: measure it.
#
# WHAT IT REPORTS, per frequency
#   phy       registered / disabled / absent      (iw phy info)
#   regpwr    the dBm the regdomain grants        (iw phy info)
#   state     hostapd's own view                  (hostapd_cli status)
#   actual    the frequency hostapd really landed on
#   txpower   what the interface ended up at      (iw dev info)
#
# A frequency is only genuinely usable when state=ENABLED, actual matches
# what was asked, and txpower is not 0.
#
# Usage:
#   horus-freq-probe.sh                 # the default representative sample
#   horus-freq-probe.sh 5180 5185 5445  # specific frequencies
#   HTMODE=HT40 horus-freq-probe.sh     # probe a width other than HT20
#   RADIO=radio0 horus-freq-probe.sh    # probe the 2.4 GHz radio
# =====================================================================

RADIO="${RADIO:-radio1}"
HTMODE="${HTMODE:-HT20}"
SETTLE="${SETTLE:-6}"

# A deliberately mixed sample. Each group answers one question, so do not
# trim it down to "the ones that matter" - the comparison IS the result.
DEFAULT_FREQS="
5180 5240 5500 5745 5885
5445 5455 5465
5190 5210 5230 5430
5185 5195 5435 5735
5720
5905 5925
5125 5150 5175
"

IFACE=""
PHY=""
ORIG_CH=""
ORIG_HT=""

die() { echo "horus-freq-probe: $*" >&2; exit 1; }

resolve() {
	ORIG_CH=$(uci -q get "wireless.$RADIO.channel")
	ORIG_HT=$(uci -q get "wireless.$RADIO.htmode")
	[ -n "$ORIG_CH" ] || die "no such radio: $RADIO"

	# The interface name is whatever netifd built for this radio; asking
	# iw is more reliable than guessing wlan0/wlan1 ordering.
	for i in $(ls /sys/class/net 2>/dev/null); do
		[ -e "/sys/class/net/$i/phy80211" ] || continue
		p=$(basename "$(readlink -f "/sys/class/net/$i/phy80211")")
		d=$(uci -q get "wireless.$RADIO.path")
		case "$(iw dev "$i" info 2>/dev/null)" in
			*"type AP"*|*"type managed"*) ;;
			*) continue ;;
		esac
		# match the radio by its phy, via the wifi-iface device option
		for s in $(uci -q show wireless | sed -n 's/^wireless\.\([^.]*\)\.device=.*/\1/p'); do
			[ "$(uci -q get "wireless.$s.device")" = "$RADIO" ] || continue
			IFACE="$i"; PHY="$p"; break
		done
		[ -n "$IFACE" ] && break
	done
	[ -n "$IFACE" ] || die "could not resolve an interface for $RADIO"
}

restore() {
	echo ""
	echo "restoring $RADIO -> channel $ORIG_CH htmode $ORIG_HT"
	uci -q set "wireless.$RADIO.channel=$ORIG_CH"
	uci -q set "wireless.$RADIO.htmode=$ORIG_HT"
	uci commit wireless
	wifi reload >/dev/null 2>&1
}

# What the regulatory layer thinks, before we try to use the channel.
phy_state() {
	iw phy "$PHY" info 2>/dev/null | awk -v f="$1" '
		$0 ~ ("\* " f "(\.0)? MHz") {
			found = 1
			if ($0 ~ /disabled/) { print "disabled 0"; exit }
			pw = "?"
			if (match($0, /\(([0-9.]+) dBm\)/)) {
				pw = substr($0, RSTART + 1, RLENGTH - 6)
			}
			print "registered " pw
			exit
		}
		END { if (!found) print "absent -" }'
}

freq_to_chan() {
	if [ "$1" -ge 5000 ]; then echo $((($1 - 5000) / 5))
	elif [ "$1" -eq 2484 ]; then echo 14
	else echo $((($1 - 2407) / 5)); fi
}

probe_one() {
	freq="$1"
	ch=$(freq_to_chan "$freq")

	set -- $(phy_state "$freq")
	phy_reg="$1"; phy_pw="$2"

	uci -q set "wireless.$RADIO.channel=$ch"
	uci -q set "wireless.$RADIO.htmode=$HTMODE"
	uci commit wireless
	wifi reload >/dev/null 2>&1
	sleep "$SETTLE"

	state=$(hostapd_cli -i "$IFACE" status 2>/dev/null | sed -n 's/^state=//p')
	actual=$(hostapd_cli -i "$IFACE" status 2>/dev/null | sed -n 's/^freq=//p')
	[ -z "$state" ] && state="DOWN"
	[ -z "$actual" ] && actual="-"

	txp=$(iw dev "$IFACE" info 2>/dev/null | sed -n 's/.*txpower \([0-9.]*\) dBm.*/\1/p')
	[ -z "$txp" ] && txp="-"

	verdict="ok"
	[ "$state" != "ENABLED" ] && verdict="NO-BEACON"
	[ "$actual" != "-" ] && [ "$actual" != "$freq" ] && verdict="WRONG-FREQ"
	case "$txp" in
		-|0|0.00) [ "$verdict" = "ok" ] && verdict="ZERO-POWER" ;;
	esac
	[ "$phy_reg" = "absent" ] && verdict="NOT-REGISTERED"

	printf '%-6s %-4s %-11s %-7s %-9s %-6s %-8s %s\n' \
		"$freq" "$ch" "$phy_reg" "$phy_pw" "$state" "$actual" "$txp" "$verdict"
}

trap restore EXIT INT TERM

resolve
FREQS="$*"
[ -z "$FREQS" ] && FREQS="$DEFAULT_FREQS"

echo "radio=$RADIO iface=$IFACE phy=$PHY htmode=$HTMODE settle=${SETTLE}s"
echo "regdomain: $(iw reg get 2>/dev/null | sed -n 's/^country //p' | head -1)"
echo ""
printf '%-6s %-4s %-11s %-7s %-9s %-6s %-8s %s\n' \
	FREQ CH PHY REGPWR STATE ACTUAL TXPOWER VERDICT
echo "---------------------------------------------------------------------------"

for f in $FREQS; do
	case "$f" in ''|*[!0-9]*) continue ;; esac
	probe_one "$f"
done
