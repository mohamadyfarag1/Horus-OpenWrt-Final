cat << 'EOF' > /usr/bin/passive-ip-helper.sh
#!/bin/sh
mac="$1"
ip="$2"
ip neigh replace "$ip" lladdr "$mac" dev br-lan nud permanent 2>/dev/null
if [ ! -f "/tmp/dhcp-host-$mac" ] && [ ! -f "/tmp/http-host-$mac" ]; then
    title=$(wget -qO- -T 2 "http://$ip/" 2>/dev/null | grep -i '<title>' | sed -n 's/.*<title>\(.*\)<\/title>.*/\1/ip' | head -1 | tr -d '\r\n')
    if [ -n "$title" ]; then
        echo "$title" > "/tmp/http-host-$mac"
    fi
fi
> /tmp/dhcp.leases.new
for f in /tmp/arp-ip-*; do
    [ -f "$f" ] || continue
    m="${f##*-}"
    i=$(cat "$f")
    h="*"
    if [ -f "/tmp/dhcp-host-$m" ]; then
        h=$(cat "/tmp/dhcp-host-$m")
    elif [ -f "/tmp/http-host-$m" ]; then
        h=$(cat "/tmp/http-host-$m")
    fi
    echo "1999999999 $m $i $h *" >> /tmp/dhcp.leases.new
done
mv /tmp/dhcp.leases.new /tmp/dhcp.leases
EOF
chmod +x /usr/bin/passive-ip-helper.sh

cat << 'EOF' > /usr/bin/passive-ip-sniffer.sh
#!/bin/sh
LEASES="/tmp/dhcp.leases"
touch "$LEASES"
killall tcpdump 2>/dev/null

# A) Master Sniffer
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

# B) DHCP Sniffer
tcpdump -i br-lan -l -n -e -v udp port 67 or port 68 2>/dev/null | awk '
/^[0-9a-fA-F]{2}:/ { current_mac = tolower($1) }
/Hostname/ && /"/ {
    s = $0; start = index(s, "\""); end = index(substr(s, start+1), "\"")
    if (start > 0 && end > 0 && current_mac != "") {
        host = substr(s, start+1, end-1)
        system("echo \"" host "\" > /tmp/dhcp-host-" current_mac)
        system("ip=\"$(cat /tmp/arp-ip-" current_mac " 2>/dev/null)\"; [ -n \"$ip\" ] && /usr/bin/passive-ip-helper.sh " current_mac " $ip &")
    }
}
' &
EOF
chmod +x /usr/bin/passive-ip-sniffer.sh

/usr/bin/passive-ip-sniffer.sh
