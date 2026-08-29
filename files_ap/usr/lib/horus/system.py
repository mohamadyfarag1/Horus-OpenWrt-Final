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

def get_wireless_macs():
    clients = []
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
                        signal = -100
                        for p in parts:
                            if p.startswith('-') and p.lstrip('-').isdigit():
                                signal = int(p)
                                break
                        clients.append({"mac": mac, "signal": signal, "iface": iface})
            except Exception:
                pass
    except Exception:
        pass
    return clients

def get_wifi_info():
    info = []
    try:
        out = subprocess.check_output("uci show wireless", shell=True, text=True)
        ifaces = {}
        devices = {}
        for line in out.splitlines():
            line = line.strip()
            if not line or '=' not in line:
                continue
            key, val = line.split('=', 1)
            val = val.strip("'")
            parts = key.split('.')
            if len(parts) >= 3:
                if parts[1].startswith('@wifi-iface'):
                    idx = parts[1]
                    if idx not in ifaces: ifaces[idx] = {}
                    ifaces[idx][parts[2]] = val
                else:
                    dev = parts[1]
                    if dev not in devices: devices[dev] = {}
                    devices[dev][parts[2]] = val
                    
        for idx, data in ifaces.items():
            if 'device' in data:
                dev = data['device']
                iface = data.get('ifname', dev)
                ssid = data.get('ssid', '')
                enc = data.get('encryption', 'none')
                mode = data.get('mode', 'ap')
                has_pw = 'key' in data
                
                ch = 0
                band = "unknown"
                if dev in devices:
                    ch_str = devices[dev].get('channel', '0')
                    if ch_str == 'auto': ch_str = '0'
                    try: ch = int(ch_str)
                    except: ch = 0
                    band = devices[dev].get('band', 'unknown')
                
                info.append({
                    "iface": iface,
                    "device": dev,
                    "ssid": ssid,
                    "band": band,
                    "channel": ch,
                    "mode": mode,
                    "encryption": enc,
                    "has_password": has_pw
                })
    except Exception:
        pass
    return info

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
