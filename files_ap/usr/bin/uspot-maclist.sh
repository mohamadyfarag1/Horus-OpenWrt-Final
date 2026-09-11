#!/bin/sh
# ==============================================================================
# Horus-Spot — apply the local MAC bypass list (MikroTik IP Bindings style)
# ------------------------------------------------------------------------------
# Reads 'config whitelist' entries from /etc/config/uspot.
# - type 'bypassed': authorizes MAC directly (open internet).
# - type 'blocked': drops MAC in nftables.
# ==============================================================================

. /lib/functions.sh

USPOT_NAME=""
find_uspot() { [ -z "$USPOT_NAME" ] && USPOT_NAME="$1"; }
config_load uspot
config_foreach find_uspot uspot
[ -z "$USPOT_NAME" ] && USPOT_NAME="hotspot"

# Ensure the blockset exists in nftables
nft list set inet uspot block_macs >/dev/null 2>&1 || nft add set inet uspot block_macs '{ type ether_addr; }'
# Ensure the block rule exists in uspot PREROUTING
nft list chain inet uspot prerouting | grep -q "block_macs" || nft insert rule inet uspot prerouting ether saddr @block_macs drop

# Clear current block set
nft flush set inet uspot block_macs

apply_one() {
	local cfg="$1"
	local mac comment enabled type
	config_get mac "$cfg" mac ""
	config_get comment "$cfg" comment ""
	config_get type "$cfg" type "bypassed"
	config_get_bool enabled "$cfg" enabled 1
	[ -z "$mac" ] && return 0

	mac=$(echo "$mac" | tr '[A-Z]' '[a-z]')

	if [ "$enabled" = "1" ]; then
		if [ "$type" = "blocked" ]; then
			# Remove from bypass if it was there
			ubus call uspotfilter client_set "{\"interface\":\"$USPOT_NAME\",\"address\":\"$mac\",\"state\":0,\"data\":{}}" >/dev/null 2>&1
			# Add to block set
			nft add element inet uspot block_macs "{ $mac }"
			logger -t horus-spot "IP-Binding: BLOCKED $mac ($comment)"
		else
			# Bypassed
			ubus call uspotfilter client_set "{\"interface\":\"$USPOT_NAME\",\"address\":\"$mac\",\"state\":1,\"data\":{\"bypass\":\"${comment}\"}}" >/dev/null 2>&1
			logger -t horus-spot "IP-Binding: BYPASSED $mac ($comment)"
		fi
	else
		# Disabled rule - remove from both
		ubus call uspotfilter client_set "{\"interface\":\"$USPOT_NAME\",\"address\":\"$mac\",\"state\":0,\"data\":{}}" >/dev/null 2>&1
		# (We flushed the block_macs list, so we don't need to manually remove it)
		logger -t horus-spot "IP-Binding: OFF $mac ($comment)"
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
