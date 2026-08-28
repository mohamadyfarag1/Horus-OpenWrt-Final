#!/usr/bin/env python3
import os
import json
import subprocess
import time
import urllib.request
import urllib.parse
import syslog

# OpenWrt UCI helper
def get_uci_config():
    try:
        cfg = {}
        out = subprocess.check_output(['uci', 'show', 'radius_sync.main']).decode('utf-8')
        for line in out.splitlines():
            if '=' in line:
                key = line.split('=')[0].split('.')[-1]
                val = line.split('=')[1].strip("'")
                cfg[key] = val
        return cfg
    except Exception as e:
        syslog.syslog(syslog.LOG_ERR, f"RADIUS Sync: Failed to read UCI - {e}")
        return None

def get_active_macs():
    macs = {}
    
    # 1. ARP Table (for IPs)
    try:
        arp_out = subprocess.check_output(['arp', '-a']).decode('utf-8')
        for line in arp_out.splitlines():
            parts = line.split()
            if len(parts) >= 4:
                ip = parts[1].strip('()')
                mac = parts[3].upper()
                if mac != "<INCOMPLETE>":
                    macs[mac] = {'ip': ip, 'interface': 'LAN'}
    except:
        pass

    # 2. iwinfo (for WiFi interfaces)
    try:
        # Assuming phy0-ap0 and phy1-ap0 are active, or checking iwinfo for all
        iw_out = subprocess.check_output(['iwinfo']).decode('utf-8')
        ifaces = [line.split()[0] for line in iw_out.splitlines() if 'ESSID' in line]
        for iface in ifaces:
            assoc_out = subprocess.check_output(['iwinfo', iface, 'assoclist']).decode('utf-8')
            for line in assoc_out.splitlines():
                if len(line) > 17 and ':' in line:
                    mac = line.split()[0].upper()
                    if mac in macs:
                        macs[mac]['interface'] = 'WiFi (' + iface + ')'
                    else:
                        macs[mac] = {'ip': 'Unknown', 'interface': 'WiFi (' + iface + ')'}
    except:
        pass

    return macs

def query_radius(cfg, mac_array):
    if not cfg.get('base_url') or cfg.get('enabled') != '1':
        return []
    
    rtype = cfg.get('radius_type', 'sas')
    url = cfg.get('base_url').rstrip('/')
    
    results = []
    
    # --- SAS RADIUS API LOGIC ---
    if rtype == 'sas':
        api_url = f"{url}/api/v1/subscribers/mac-lookup"
        # Since we don't have the exact bulk endpoint yet, we create a mock response structure
        # In production, replace with:
        # req = urllib.request.Request(api_url, data=json.dumps({"macs": mac_array}).encode(), headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token})
        
        # MOCK FOR NOW:
        for m in mac_array:
            results.append({
                "mac": m,
                "username": "user_" + m[-5:].replace(':', ''),
                "profile": "Mega_10M",
                "status": "Active",
                "remaining": "45 GB",
                "expiration": "2026-09-01 10:00:00"
            })
            
    # --- DMA RADIUS API LOGIC ---
    elif rtype == 'dma':
        api_url = f"{url}/api/v1/dma/users"
        for m in mac_array:
            results.append({
                "mac": m,
                "username": "dma_" + m[-2:],
                "profile": "DMA_Profile",
                "status": "Active",
                "remaining": "100 GB",
                "expiration": "2026-12-31"
            })
            
    return results

def main():
    syslog.openlog(ident='radius_sync', facility=syslog.LOG_DAEMON)
    syslog.syslog(syslog.LOG_INFO, "RADIUS Sync Daemon started.")
    
    while True:
        cfg = get_uci_config()
        if not cfg or cfg.get('enabled') != '1':
            time.sleep(10)
            continue
            
        try:
            interval = int(cfg.get('sync_interval', 60))
        except:
            interval = 60
            
        mac_dict = get_active_macs()
        mac_array = list(mac_dict.keys())
        
        if len(mac_array) > 0:
            radius_data = query_radius(cfg, mac_array)
            
            # Merge data
            merged_clients = []
            for mac, local_info in mac_dict.items():
                client_obj = {
                    "mac": mac,
                    "ip": local_info['ip'],
                    "interface": local_info['interface']
                }
                
                # Find radius match
                r_match = next((item for item in radius_data if item["mac"] == mac), None)
                if r_match:
                    client_obj.update(r_match)
                
                merged_clients.append(client_obj)
                
            out_data = {"clients": merged_clients}
            
            # Write to /tmp for LuCI to read
            with open('/tmp/radius_users.json', 'w') as f:
                json.dump(out_data, f)
                
        time.sleep(interval)

if __name__ == "__main__":
    main()
