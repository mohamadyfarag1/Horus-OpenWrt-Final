# -*- coding: utf-8 -*-
import os
import subprocess
from .config import INTERFACE

def get_uci(path, default=None):
    try:
        out = subprocess.check_output(f"uci -q get {path}", shell=True, text=True).strip()
        return out if out else default
    except Exception:
        return default

def get_my_mac():
    try:
        with open(f"/sys/class/net/{INTERFACE}/address", "r") as f:
            return f.read().strip().upper()
    except Exception:
        return "00:00:00:00:00:00"

def get_lan_ip():
    try:
        out = subprocess.check_output("uci -q get network.lan.ipaddr", shell=True, text=True).strip()
        return out if out else "0.0.0.0"
    except Exception:
        return "0.0.0.0"

def get_hostname():
    try:
        with open("/proc/sys/kernel/hostname", "r") as f:
            return f.read().strip()
    except Exception:
        return "Horus-AP"

import time
import json

PREV_CLIENT_STATS = {}
PREV_SYS_NET = {"rx": 0, "tx": 0, "ts": 0}

def format_speed(bps):
    if bps >= 1000000:
        return f"{bps / 1000000:.1f} Mbps"
    elif bps >= 1000:
        return f"{bps / 1000:.0f} Kbps"
    else:
        return f"{bps:.0f} bps"

def format_bytes(b):
    if b >= 1073741824:
        return f"{b / 1073741824:.2f} GB"
    elif b >= 1048576:
        return f"{b / 1048576:.1f} MB"
    elif b >= 1024:
        return f"{b / 1024:.0f} KB"
    else:
        return f"{b} B"

def get_system_stats():
    global PREV_SYS_NET
    now = time.time()
    cpu_load = "0.0"
    mem_used_pct = 0
    rx_speed_bps = 0
    tx_speed_bps = 0
    total_rx = 0
    total_tx = 0

    # CPU Load
    try:
        with open("/proc/loadavg", "r") as f:
            cpu_load = f.read().split()[0]
    except Exception:
        pass

    # RAM Usage
    try:
        mem_total = 0
        mem_free = 0
        mem_avail = 0
        with open("/proc/meminfo", "r") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    mem_total = int(line.split()[1])
                elif line.startswith("MemAvailable:"):
                    mem_avail = int(line.split()[1])
                elif line.startswith("MemFree:") and mem_avail == 0:
                    mem_free = int(line.split()[1])
        if mem_avail > 0 and mem_total > 0:
            mem_used_pct = int(((mem_total - mem_avail) / mem_total) * 100)
        elif mem_free > 0 and mem_total > 0:
            mem_used_pct = int(((mem_total - mem_free) / mem_total) * 100)
    except Exception:
        pass

    # Bandwidth Throughput on br-lan
    try:
        rx_p = f"/sys/class/net/{INTERFACE}/statistics/rx_bytes"
        tx_p = f"/sys/class/net/{INTERFACE}/statistics/tx_bytes"
        if os.path.exists(rx_p) and os.path.exists(tx_p):
            with open(rx_p, "r") as f: total_rx = int(f.read().strip())
            with open(tx_p, "r") as f: total_tx = int(f.read().strip())
            
            if PREV_SYS_NET["ts"] > 0:
                dt = now - PREV_SYS_NET["ts"]
                if dt > 0.5:
                    rx_speed_bps = max(0, total_rx - PREV_SYS_NET["rx"]) * 8 / dt
                    tx_speed_bps = max(0, total_tx - PREV_SYS_NET["tx"]) * 8 / dt
            PREV_SYS_NET = {"rx": total_rx, "tx": total_tx, "ts": now}
    except Exception:
        pass

    return {
        "cpu_load": cpu_load,
        "mem_pct": mem_used_pct,
        "rx_speed": format_speed(rx_speed_bps),
        "tx_speed": format_speed(tx_speed_bps),
        "rx_speed_bps": int(rx_speed_bps),
        "tx_speed_bps": int(tx_speed_bps),
        "total_rx": format_bytes(total_rx),
        "total_tx": format_bytes(total_tx)
    }

def get_wireless_macs():
    global PREV_CLIENT_STATS
    now = time.time()
    clients = []
    seen_macs = set()

    # 1. Primary: Query hostapd ubus for deep stats (rx_bytes, tx_bytes, rate, signal)
    try:
        out = subprocess.check_output("ubus list | grep hostapd", shell=True, text=True)
        for h in out.splitlines():
            h = h.strip()
            if not h: continue
            iface_name = h.replace("hostapd.", "")
            try:
                raw = subprocess.check_output(f"ubus call {h} get_clients", shell=True, text=True)
                data = json.loads(raw)
                cl_dict = data.get("clients", {})
                for mac_str, info in cl_dict.items():
                    mac = mac_str.upper()
                    seen_macs.add(mac)
                    sig = info.get("signal", -100)
                    rx_b = info.get("bytes", {}).get("rx", 0)
                    tx_b = info.get("bytes", {}).get("tx", 0)
                    rate_tx = info.get("rate", {}).get("tx", 0)

                    rx_speed_bps = 0
                    tx_speed_bps = 0
                    if mac in PREV_CLIENT_STATS:
                        dt = now - PREV_CLIENT_STATS[mac]["ts"]
                        if dt > 0.5:
                            rx_speed_bps = max(0, rx_b - PREV_CLIENT_STATS[mac]["rx"]) * 8 / dt
                            tx_speed_bps = max(0, tx_b - PREV_CLIENT_STATS[mac]["tx"]) * 8 / dt
                    PREV_CLIENT_STATS[mac] = {"rx": rx_b, "tx": tx_b, "ts": now}

                    clients.append({
                        "mac": mac,
                        "signal": sig,
                        "iface": iface_name,
                        "rx_speed": format_speed(rx_speed_bps),
                        "tx_speed": format_speed(tx_speed_bps),
                        "rx_speed_bps": int(rx_speed_bps),
                        "tx_speed_bps": int(tx_speed_bps),
                        "total_rx": format_bytes(rx_b),
                        "total_tx": format_bytes(tx_b),
                        "link_rate": format_speed(rate_tx) if rate_tx > 0 else "-"
                    })
            except Exception:
                pass
    except Exception:
        pass

    # 2. Fallback: iwinfo assoclist if ubus returned no clients
    if len(clients) == 0:
        try:
            out = subprocess.check_output("iwinfo | grep -E '^[a-zA-Z0-9_-]+'", shell=True, text=True)
            interfaces = [line.split()[0] for line in out.splitlines() if line.strip()]
            for iface in interfaces:
                try:
                    assoc = subprocess.check_output(f"iwinfo {iface} assoclist", shell=True, text=True)
                    for line in assoc.splitlines():
                        if ' dBm' in line or 'SNR' in line:
                            parts = line.split()
                            mac = parts[0].upper()
                            if mac in seen_macs: continue
                            seen_macs.add(mac)
                            signal = -100
                            for p in parts:
                                if p.startswith('-') and p.lstrip('-').isdigit():
                                    signal = int(p)
                                    break
                            clients.append({
                                "mac": mac,
                                "signal": signal,
                                "iface": iface,
                                "rx_speed": "0 bps",
                                "tx_speed": "0 bps",
                                "rx_speed_bps": 0,
                                "tx_speed_bps": 0,
                                "total_rx": "-",
                                "total_tx": "-",
                                "link_rate": "-"
                            })
                except Exception:
                    pass
        except Exception:
            pass

    return clients

def get_wifi_info():
    info = []
    try:
        out = subprocess.check_output("uci show wireless", shell=True, text=True)
        devices = {}
        ifaces = {}
        for line in out.splitlines():
            line = line.strip()
            if not line or '=' not in line: continue
            k, v = line.split('=', 1)
            v = v.strip("'")
            parts = k.split('.')
            if len(parts) >= 3:
                sec = parts[1]
                prop = parts[2]
                if prop == 'type' and v == 'mac80211':
                    devices[sec] = devices.get(sec, {})
                if prop == 'device':
                    ifaces[sec] = ifaces.get(sec, {})
                    ifaces[sec]['device'] = v
                if sec in devices: devices[sec][prop] = v
                elif sec in ifaces: ifaces[sec][prop] = v
                else:
                    if 'radio' in sec:
                        devices[sec] = devices.get(sec, {})
                        devices[sec][prop] = v
                    else:
                        ifaces[sec] = ifaces.get(sec, {})
                        ifaces[sec][prop] = v
        
        iw_data = {}
        try:
            iw_out = subprocess.check_output("iwinfo", shell=True, text=True)
            cur_iface = None
            for line in iw_out.splitlines():
                if line and not line.startswith(' '):
                    cur_iface = line.split()[0]
                    iw_data[cur_iface] = {'iface': cur_iface}
                elif cur_iface and line:
                    if 'ESSID:' in line:
                        m = re.search(r'ESSID:\s*"(.*?)"', line)
                        if m: iw_data[cur_iface]['ssid'] = m.group(1)
                    if 'Channel:' in line:
                        m = re.search(r'Channel:\s*(\d+)\s*\((.*?)\)', line)
                        if m:
                            iw_data[cur_iface]['channel'] = int(m.group(1))
                            iw_data[cur_iface]['freq'] = m.group(2)
                    if 'HT Mode:' in line:
                        m = re.search(r'HT Mode:\s*(\S+)', line)
                        if m: iw_data[cur_iface]['htmode'] = m.group(1)
                    if 'Tx-Power:' in line:
                        m = re.search(r'Tx-Power:\s*(\d+)\s*dBm', line)
                        if m: iw_data[cur_iface]['txpower'] = int(m.group(1))
                    if 'Mode:' in line:
                        m = re.search(r'Mode:\s*(\S+)', line)
                        if m: iw_data[cur_iface]['mode'] = m.group(1)
                    if 'Encryption:' in line:
                        m = re.search(r'Encryption:\s*(.*)', line)
                        if m: iw_data[cur_iface]['encryption'] = m.group(1).strip()
        except Exception:
            pass

        for dev_name, dev in devices.items():
            band = dev.get('band', '')
            if not band:
                band = '5g' if ('5' in dev_name or '1' in dev_name) else '2g'
            ch = dev.get('channel', 'auto')
            htmode = dev.get('htmode', 'HT20')
            txpower = dev.get('txpower', '20')
            disabled = (dev.get('disabled', '0') == '1')
            
            matched_iface = {}
            for if_name, if_data in ifaces.items():
                if if_data.get('device') == dev_name:
                    matched_iface = if_data
                    break
            
            ssid = matched_iface.get('ssid', '')
            enc = matched_iface.get('encryption', 'none')
            mode = matched_iface.get('mode', 'ap')
            
            for iw_k, iw_v in iw_data.items():
                if (ssid and iw_v.get('ssid') == ssid) or (band == '2g' and iw_v.get('channel', 99) <= 14) or (band in ['5g', '6g'] and iw_v.get('channel', 0) >= 36):
                    if iw_v.get('channel'): ch = str(iw_v['channel'])
                    if iw_v.get('htmode'): htmode = iw_v['htmode']
                    if iw_v.get('txpower'): txpower = str(iw_v['txpower'])
                    if iw_v.get('ssid'): ssid = iw_v['ssid']
                    break
            
            info.append({
                'device': dev_name,
                'band': '2.4GHz' if band in ['2g', '2.4g', '2.4GHz'] else '5GHz',
                'band_code': '2g' if band in ['2g', '2.4g', '2.4GHz'] else '5g',
                'ssid': ssid or 'Horus-WiFi',
                'channel': str(ch),
                'htmode': htmode,
                'txpower': str(txpower),
                'disabled': disabled,
                'encryption': enc,
                'mode': mode
            })
    except Exception:
        pass
    return info

def get_ethernet_ports():
    ports = []
    try:
        arp_map = {}
        try:
            with open("/proc/net/arp", "r") as f:
                for line in f.readlines()[1:]:
                    parts = line.split()
                    if len(parts) >= 6:
                        ip_addr, mac_addr = parts[0], parts[3].upper()
                        if mac_addr != "00:00:00:00:00:00":
                            arp_map[mac_addr] = ip_addr
        except Exception:
            pass

        port_macs = {}
        try:
            out = subprocess.check_output("brctl showmacs br-lan 2>/dev/null", shell=True, text=True)
            for line in out.splitlines()[1:]:
                parts = line.split()
                if len(parts) >= 3 and parts[2] == "no":
                    p_num = parts[0]
                    cmac = parts[1].upper()
                    if p_num not in port_macs: port_macs[p_num] = []
                    port_macs[p_num].append(cmac)
        except Exception:
            pass

        for p in ['lan1', 'lan2', 'lan3', 'lan4', 'wan']:
            p_path = f"/sys/class/net/{p}"
            if os.path.exists(p_path):
                oper = "down"
                speed = 0
                duplex = "full"
                try:
                    with open(f"{p_path}/operstate", "r") as f:
                        oper = f.read().strip()
                except Exception:
                    pass
                try:
                    with open(f"{p_path}/speed", "r") as f:
                        speed = int(f.read().strip())
                except Exception:
                    pass
                try:
                    with open(f"{p_path}/duplex", "r") as f:
                        duplex = f.read().strip()
                except Exception:
                    pass
                
                attached_clients = []
                p_num = p.replace('lan', '')
                if p_num in port_macs:
                    for cmac in port_macs[p_num]:
                        attached_clients.append({
                            "mac": cmac,
                            "ip": arp_map.get(cmac, "")
                        })

                ports.append({
                    "port": p,
                    "label": p.upper(),
                    "state": oper,
                    "is_up": (oper == "up"),
                    "speed": speed if oper == "up" else 0,
                    "speed_str": f"{speed} Mbps {duplex}" if oper == "up" and speed > 0 else ("متصل" if oper == "up" else "مفصول"),
                    "clients": attached_clients
                })
    except Exception:
        pass
    return ports

def ban_mac_locally(mac):
    try:
        out = subprocess.check_output("ubus list | grep hostapd", shell=True, text=True)
        for h in out.splitlines():
            subprocess.run(f"ubus call {h.strip()} del_client '{{\"addr\":\"{mac}\", \"ban_time\": 0}}'", shell=True)
        subprocess.run(f"iptables -I FORWARD 1 -m mac --mac-source {mac} -j DROP", shell=True)
    except Exception:
        pass

def unban_mac_locally(mac):
    try:
        subprocess.run(f"iptables -D FORWARD -m mac --mac-source {mac} -j DROP", shell=True)
    except Exception:
        pass

def apply_wifi_config(action, iface_name, value="", **kwargs):
    try:
        out = subprocess.check_output("uci show wireless", shell=True, text=True)
        lines = out.splitlines()

        if action == "apply_profile":
            target_band = kwargs.get("band", "both")
            ssid = kwargs.get("ssid", "")
            key = kwargs.get("password", "")
            enc = kwargs.get("encryption", "psk2")

            devices = {}
            ifaces = {}
            for line in lines:
                if "=" not in line: continue
                k, v = line.split("=", 1)
                v = v.strip("'")
                parts = k.split(".")
                if len(parts) == 2 and v == "wifi-device":
                    devices[parts[1]] = {"id": parts[1]}
                elif len(parts) == 2 and v == "wifi-iface":
                    ifaces[parts[1]] = {"id": parts[1]}
                elif len(parts) == 3:
                    sec = parts[1]
                    prop = parts[2]
                    if sec in devices: devices[sec][prop] = v
                    if sec in ifaces: ifaces[sec][prop] = v

            for iface_id, idata in ifaces.items():
                dev = idata.get("device")
                if not dev or dev not in devices: continue

                ddata = devices[dev]
                d_band = ddata.get("band", "")
                d_hwmode = ddata.get("hwmode", "")
                
                is_2g = (d_band == "2g" or d_hwmode in ["11b", "11g"])
                is_5g = (d_band in ["5g", "6g"] or d_hwmode in ["11a", "11ac", "11ax"])
                
                if not is_2g and not is_5g:
                    if "5" in dev: is_5g = True
                    else: is_2g = True

                match = False
                if target_band == "both": match = True
                elif target_band == "2g" and is_2g: match = True
                elif target_band == "5g" and is_5g: match = True

                if match:
                    if ssid: subprocess.run(f"uci set wireless.{iface_id}.ssid='{ssid}'", shell=True)
                    if key: subprocess.run(f"uci set wireless.{iface_id}.key='{key}'", shell=True)
                    if enc: subprocess.run(f"uci set wireless.{iface_id}.encryption='{enc}'", shell=True)
                    
            subprocess.run("uci commit wireless", shell=True)
            subprocess.run("wifi reload", shell=True)
            return

        # Legacy logic for single interface actions
        section = None
        for line in lines:
            if iface_name == "ALL" and ".device=" not in line and "wifi-iface" in line:
                section = line.split('.')[1]
                break
            if f"ifname='{iface_name}'" in line or f"ifname={iface_name}" in line or f"device='{iface_name}'" in line:
                section = line.split('.')[1]
                break
        
        if section:
            if action == "set_password":
                subprocess.run(f"uci set wireless.{section}.key='{value}'", shell=True)
                subprocess.run(f"uci set wireless.{section}.encryption='psk2'", shell=True)
            elif action == "set_ssid":
                subprocess.run(f"uci set wireless.{section}.ssid='{value}'", shell=True)
            elif action == "set_channel":
                dev_out = subprocess.check_output(f"uci -q get wireless.{section}.device", shell=True, text=True).strip() or section
                subprocess.run(f"uci set wireless.{dev_out}.channel='{value}'", shell=True)
            elif action == "set_mode":
                subprocess.run(f"uci set wireless.{section}.mode='{value}'", shell=True)
            elif action == "set_encryption":
                subprocess.run(f"uci set wireless.{section}.encryption='{value}'", shell=True)
            elif action == "set_htmode":
                dev_out = subprocess.check_output(f"uci -q get wireless.{section}.device", shell=True, text=True).strip() or section
                subprocess.run(f"uci set wireless.{dev_out}.htmode='{value}'", shell=True)
            
            subprocess.run("uci commit wireless", shell=True)
            subprocess.run("wifi reload", shell=True)
    except Exception:
        pass

def steer_client_locally(mac, target_bssid=None, ban_time=3000):
    try:
        out = subprocess.check_output("ubus list | grep hostapd", shell=True, text=True)
        for h in out.splitlines():
            h = h.strip()
            if not h: continue
            # 1. 802.11v BSS Transition Request
            if target_bssid:
                try:
                    subprocess.run(
                        f"ubus call {h} bss_transition_request '{{\"addr\":\"{mac}\", \"disassociation_imminent\":true, \"disassociation_timer\":10, \"neighbors\":[\"{target_bssid}\"]}}'",
                        shell=True, timeout=2
                    )
                except Exception:
                    pass
            # 2. Deauthenticate / Disassociate with probe suppression ban_time (forces association to closer AP)
            try:
                subprocess.run(
                    f"ubus call {h} del_client '{{\"addr\":\"{mac}\", \"reason\":1, \"deauth\":true, \"ban_time\":{ban_time}}}'",
                    shell=True, timeout=2
                )
            except Exception:
                pass
    except Exception:
        pass

def enable_80211kv_locally():
    try:
        out = subprocess.check_output("uci show wireless", shell=True, text=True)
        ifaces = [l.split('.')[1].split('=')[0] for l in out.splitlines() if 'wifi-iface' in l and '=wifi-iface' in l]
        for iface in ifaces:
            subprocess.run(f"uci set wireless.{iface}.ieee80211k='1'", shell=True)
            subprocess.run(f"uci set wireless.{iface}.ieee80211v='1'", shell=True)
            subprocess.run(f"uci set wireless.{iface}.bss_transition='1'", shell=True)
            subprocess.run(f"uci set wireless.{iface}.wnm_sleep_mode='1'", shell=True)
        subprocess.run("uci commit wireless", shell=True)
        subprocess.run("wifi reload", shell=True)
    except Exception:
        pass

