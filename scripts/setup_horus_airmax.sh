#!/bin/sh
# ==============================================================================
# Horus AirMAX Mode - Advanced PTMP Optimization for OpenWrt
# ==============================================================================
# This script configures the wireless interfaces to solve the same physical
# problems that Ubiquiti's airMAX TDMA protocol solves (Hidden Node, Airtime
# Starvation, Long-Distance Latency) using standard 802.11 mechanisms.
# ==============================================================================

echo "[*] Activating Horus AirMAX Mode..."

# 1. Horus Anti-Collision (RTS/CTS)
# Solves the "Hidden Node Problem" (which TDMA polling is designed to solve).
# By setting RTS threshold to a low value (e.g., 256 or 512 bytes), clients must
# ask the AP for permission (RTS) and wait for the AP's broadcast (CTS) before
# transmitting. This guarantees no two clients transmit over each other, even
# if they can't physically "hear" each other.
uci set wireless.radio0.rts='512'
uci set wireless.radio1.rts='512'

# 2. Horus Distance Sync (ACK Timeout)
# In long-distance outdoor links, the speed of light causes ACKs to arrive late.
# Standard WiFi assumes a collision and retransmits, killing throughput.
# Setting distance adjusts the ACK timeout window perfectly. (Value in meters)
uci set wireless.radio0.distance='5000' # 5 KM
uci set wireless.radio1.distance='5000'

# 3. Horus Airtime Fairness (ATF)
# Solves "Slow Client Starvation". If a client has a weak signal (1Mbps), it will
# normally monopolize the airtime and slow down clients with a strong signal.
# ATF ensures the AP divides TIME fairly, not data, just like airMAX timeslots.
# (Note: Requires driver support, typically supported on mac80211)
# Note: For some OpenWrt versions, ATF is handled via BQL/FQ-CoDel in SQM.
uci set wireless.radio0.airtime_fairness='1'
uci set wireless.radio1.airtime_fairness='1'

# 4. Horus L2 Isolation
# In a PTMP setup, clients should not broadcast directly to each other.
# AP Isolation drops client-to-client traffic at the MAC layer, saving airtime.
for iface in $(uci show wireless | grep "=wifi-iface" | cut -d'.' -f2); do
    uci set wireless.$iface.isolate='1'
    
    # 5. Horus Multicast Accelerator (Multicast-to-Unicast)
    # Broadcasts (like ARP or DHCP) are sent at the lowest basic rate (1Mbps),
    # wasting huge amounts of airtime. Converting them to Unicast sends them
    # at the client's high modulation rate (e.g., 300Mbps).
    uci set wireless.$iface.multicast_to_unicast='1'
done

# Commit changes and restart wireless
uci commit wireless
wifi reload

echo "[*] Horus AirMAX Mode Activated Successfully! 🚀"
