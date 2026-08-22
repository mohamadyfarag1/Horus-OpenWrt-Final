#!/bin/sh
mac=$1
ip=$2
ip neigh replace $ip lladdr $mac dev br-lan nud permanent 2>/dev/null
> /tmp/dhcp.leases.new
for f in /tmp/arp-ip-*; do
    [ -f $f ] || continue
    m=${f##*-}
    i=$(cat $f)
    echo "1999999999 $m $i * *" >> /tmp/dhcp.leases.new
done
mv /tmp/dhcp.leases.new /tmp/dhcp.leases