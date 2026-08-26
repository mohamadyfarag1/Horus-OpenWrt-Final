# ☁️ Cloudflare Zero-Trust Tunneling, Remote Access, & Passive ARP Sniffer

## 1. Cloudflare Zero-Trust Tunnel Architecture

Traditional remote access requires:
- Public static IP (Real IP).
- Opening WAN ports in firewall (high security risk for DDoS and port scanners).
- Dynamic DNS (DDNS) setup.

**Cloudflare Tunnel (`cloudflared`)** inverts the connection model:
```
+----------------+      Outbound HTTPS (Port 443)      +--------------------+
|  Horus Router  | ==================================> | Cloudflare Edge    |
| (192.168.100.1)|                                     | (opsegypt.com)     |
+----------------+                                     +--------------------+
        |                                                        |
        | Internal Proxy (HTTP/HTTPS/TCP/SSH)                    | Secure HTTPS
        ↓                                                        ↓
[DVR / Camera / Web Panel]                              [Remote User / Mobile]
(192.168.100.10:8000)                                   (https://dvr1.opsegypt.com)
```

---

## 2. Ingress Configuration & LuCI Interface
The Cloud App (`files/usr/lib/lua/luci/model/cbi/cloud/settings.lua`) allows mapping subdomains to local IP addresses and ports.

When devices are added, `cloud-daemon.sh` dynamically builds an Ingress routing array:
```json
[
  {
    "hostname": "961ee63e4175.opsegypt.com",
    "service": "http://127.0.0.1:80"
  },
  {
    "hostname": "dvr.opsegypt.com",
    "service": "http://192.168.100.10:8000"
  },
  {
    "service": "http_status:404"
  }
]
```
The daemon registers CNAME DNS records automatically via the Cloudflare REST API v4:
`POST https://api.cloudflare.com/client/v4/zones/{ZONE_ID}/dns_records`

---

## 3. Passive ARP & DHCP Sniffer (`passive-ip-sniffer.sh`)
Standard OpenWrt relies on `dnsmasq` DHCP leases to display hostnames and IP addresses. However, static IP devices (such as DVRs, printers, and cameras) do not send DHCP requests and therefore remain invisible in the DHCP leases table.

### Solution:
A lightweight background sniffer monitors ARP and DHCP broadcast frames on the LAN bridge (`br-lan`):
```bash
tcpdump -i br-lan -l -n -e -t 'arp or icmp' 2>/dev/null | awk '
{
    mac = tolower($1);
    # Extract IP and correlate with MAC
    if (ip ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/ && mac ~ /^[0-9a-f]{2}:/) {
        system("/usr/bin/passive-ip-helper.sh " mac " " ip " &")
    }
}
'
```
`passive-ip-helper.sh` performs two functions:
1. Queries the device's web server on port 80 to extract its `<title>` tag (identifying device manufacturer/model).
2. Appends the discovered IP, MAC, and Hostname directly into `/tmp/dhcp.leases` so it appears immediately in the LuCI Connected Clients table!
