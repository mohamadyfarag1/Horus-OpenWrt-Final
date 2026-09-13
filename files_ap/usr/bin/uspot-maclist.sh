#!/bin/sh
# ==============================================================================
# Horus-Spot — apply the local MAC bypass list (MikroTik IP Bindings style)
# Called by LuCI bypass.js on Save & Apply
# ==============================================================================

. /lib/functions.sh

# --- 1. Ensure nftables sets exist ---
nft list set inet fw4 block_macs >/dev/null 2>&1 || \
    nft add set inet fw4 block_macs '{ type ether_addr; }'
nft list set inet fw4 bypass_macs >/dev/null 2>&1 || \
    nft add set inet fw4 bypass_macs '{ type ether_addr; }'

# --- 2. Ensure firewall rules reference these sets ---
nft list chain inet fw4 uspot_prerouting 2>/dev/null | grep -q "block_macs" || {
    nft add chain inet fw4 uspot_prerouting 2>/dev/null
    nft insert rule inet fw4 uspot_prerouting ether saddr @block_macs drop
}
nft list chain inet fw4 uspot_forward 2>/dev/null | grep -q "bypass_macs" || {
    nft insert rule inet fw4 uspot_forward ether saddr @bypass_macs accept
}
nft list chain inet fw4 uspot_dstnat 2>/dev/null | grep -q "bypass_macs" || {
    nft insert rule inet fw4 uspot_dstnat ether saddr @bypass_macs accept
}

# --- 3. Flush both sets (start clean) ---
nft flush set inet fw4 block_macs
nft flush set inet fw4 bypass_macs

# --- 4. Re-populate from UCI config ---
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
            nft add element inet fw4 block_macs "{ $mac }"
            logger -t horus-spot "IP-Binding: BLOCKED $mac ($comment)"
        else
            nft add element inet fw4 bypass_macs "{ $mac }"
            logger -t horus-spot "IP-Binding: BYPASSED $mac ($comment)"
        fi
    fi
}

case "$1" in
    apply|"")
        config_load uspot
        config_foreach apply_one whitelist

        # --- 5. CRITICAL: Kill ALL existing connections ---
        # This ensures that devices removed from bypass lose internet IMMEDIATELY.
        # Without this, Linux flow-offloading keeps old connections alive even
        # after the MAC is removed from bypass_macs.
        conntrack -F 2>/dev/null
        logger -t horus-spot "IP-Bindings applied. All connections flushed."
        ;;
    *)
        echo "Usage: $0 apply"
        exit 1
        ;;
esac

exit 0