#!/bin/sh
LEASES="/tmp/dhcp.leases"
touch $LEASES
killall tcpdump 2>/dev/null

tcpdump -i br-lan -l -n -e -t 'arp or icmp' 2>/dev/null | awk '
{
    mac = tolower($1);
    ip = "";
    if ($4 == "IPv4" || $5 == "IPv4") {
        for(i=1; i<=NF; i++) {
            if ($i ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+(>|:)/ || $(i+1) == ">") {
                ip = $i; sub(/:$/, "", ip); sub(/\.[0-9]+$/, "", ip); break;
            }
        }
    } else {
        for(i=1; i<=NF; i++) {
            if ($i == "tell") { ip = $(i+1); gsub(/,/, "", ip); break; }
            if ($i == "Reply") { ip = $(i+1); break; }
        }
    }
    if (ip ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/ && mac ~ /^[0-9a-f]{2}:/) {
        if (!seen[mac]) {
            seen[mac] = 1
            system("echo " ip " > /tmp/arp-ip-" mac)
            system("/usr/bin/passive-ip-helper.sh " mac " " ip " &")
        }
    }
}
' &