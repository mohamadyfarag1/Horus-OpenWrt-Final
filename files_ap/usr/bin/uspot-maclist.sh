#!/bin/sh
# ==============================================================================
# Horus-Spot — apply the local MAC bypass list (open internet without RADIUS)
# ------------------------------------------------------------------------------
# Reads 'config whitelist' entries from /etc/config/uspot and authorizes each
# enabled MAC directly in the firewall via uspotfilter (MikroTik "bypassed").
# Usage: uspot-maclist.sh apply   (also run on boot and interface up)
# ==============================================================================

. /lib/functions.sh

# find the uspot section name (the captive "interface" key used by uspotfilter)
USPOT_NAME=""
find_uspot() { [ -z "$USPOT_NAME" ] && USPOT_NAME="$1"; }
config_load uspot
config_foreach find_uspot uspot
[ -z "$USPOT_NAME" ] && USPOT_NAME="hotspot"

apply_one() {
	local cfg="$1"
	local mac comment enabled
	config_get mac "$cfg" mac ""
	config_get comment "$cfg" comment ""
	config_get_bool enabled "$cfg" enabled 1
	[ -z "$mac" ] && return 0

	if [ "$enabled" = "1" ]; then
		ubus call uspotfilter client_set \
			"{\"interface\":\"$USPOT_NAME\",\"address\":\"$mac\",\"state\":1,\"data\":{\"bypass\":\"${comment}\"}}" \
			>/dev/null 2>&1
		logger -t horus-spot "bypass ON  $mac ($comment)"
	else
		ubus call uspotfilter client_set \
			"{\"interface\":\"$USPOT_NAME\",\"address\":\"$mac\",\"state\":0,\"data\":{}}" \
			>/dev/null 2>&1
		logger -t horus-spot "bypass OFF $mac ($comment)"
	fi
}

case "$1" in
	apply|"")
		config_load uspot
		config_foreach apply_one whitelist
		;;
	*)
		echo "Usage: $0 apply"
		exit 1
		;;
esac

exit 0
