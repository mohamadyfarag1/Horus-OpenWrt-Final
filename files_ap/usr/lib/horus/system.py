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

OUI_MAP = {
    # Apple
    "00:03:93": ("Apple", "🍎"), "00:05:02": ("Apple", "🍎"), "00:0A:27": ("Apple", "🍎"), "00:0A:95": ("Apple", "🍎"),
    "00:0D:93": ("Apple", "🍎"), "00:10:FA": ("Apple", "🍎"), "00:11:24": ("Apple", "🍎"), "00:14:51": ("Apple", "🍎"),
    "00:16:CB": ("Apple", "🍎"), "00:17:F2": ("Apple", "🍎"), "00:19:E3": ("Apple", "🍎"), "00:1B:63": ("Apple", "🍎"),
    "00:1C:B3": ("Apple", "🍎"), "00:1D:4F": ("Apple", "🍎"), "00:1E:52": ("Apple", "🍎"), "00:1E:C2": ("Apple", "🍎"),
    "00:1F:5B": ("Apple", "🍎"), "00:1F:F3": ("Apple", "🍎"), "00:21:E9": ("Apple", "🍎"), "00:22:41": ("Apple", "🍎"),
    "00:23:12": ("Apple", "🍎"), "00:23:32": ("Apple", "🍎"), "00:23:6C": ("Apple", "🍎"), "00:23:DF": ("Apple", "🍎"),
    "00:24:36": ("Apple", "🍎"), "00:25:00": ("Apple", "🍎"), "00:25:4B": ("Apple", "🍎"), "00:25:BC": ("Apple", "🍎"),
    "00:26:08": ("Apple", "🍎"), "00:26:4A": ("Apple", "🍎"), "00:26:B0": ("Apple", "🍎"), "00:26:BB": ("Apple", "🍎"),
    "18:AF:61": ("Apple", "🍎"), "28:CF:E9": ("Apple", "🍎"), "34:36:3B": ("Apple", "🍎"), "38:CA:DA": ("Apple", "🍎"),
    "3C:D0:F8": ("Apple", "🍎"), "40:6C:8F": ("Apple", "🍎"), "44:4C:0C": ("Apple", "🍎"), "48:D7:05": ("Apple", "🍎"),
    "4C:32:75": ("Apple", "🍎"), "50:BC:96": ("Apple", "🍎"), "54:26:96": ("Apple", "🍎"), "58:55:CA": ("Apple", "🍎"),
    "5C:95:AE": ("Apple", "🍎"), "60:03:08": ("Apple", "🍎"), "64:20:0C": ("Apple", "🍎"), "68:96:7B": ("Apple", "🍎"),
    "6C:40:08": ("Apple", "🍎"), "70:11:24": ("Apple", "🍎"), "74:E1:B6": ("Apple", "🍎"), "78:7B:8A": ("Apple", "🍎"),
    "7C:04:D0": ("Apple", "🍎"), "80:49:71": ("Apple", "🍎"), "84:78:8B": ("Apple", "🍎"), "88:66:5A": ("Apple", "🍎"),
    "8C:85:90": ("Apple", "🍎"), "90:72:40": ("Apple", "🍎"), "94:10:3E": ("Apple", "🍎"), "98:01:A7": ("Apple", "🍎"),
    "9C:20:7B": ("Apple", "🍎"), "A0:99:9B": ("Apple", "🍎"), "A4:C3:61": ("Apple", "🍎"), "A8:66:7F": ("Apple", "🍎"),
    "AC:BC:32": ("Apple", "🍎"), "B0:34:95": ("Apple", "🍎"), "B4:18:D1": ("Apple", "🍎"), "B8:78:2E": ("Apple", "🍎"),
    "BC:54:51": ("Apple", "🍎"), "C0:84:7D": ("Apple", "🍎"), "C4:2C:03": ("Apple", "🍎"), "C8:69:CD": ("Apple", "🍎"),
    "CC:25:EF": ("Apple", "🍎"), "D0:23:DB": ("Apple", "🍎"), "D4:90:9C": ("Apple", "🍎"), "D8:96:95": ("Apple", "🍎"),
    "DC:52:85": ("Apple", "🍎"), "E0:B9:BA": ("Apple", "🍎"), "E4:8B:7F": ("Apple", "🍎"), "E8:80:2E": ("Apple", "🍎"),
    "EC:35:86": ("Apple", "🍎"), "F0:18:98": ("Apple", "🍎"), "F4:0F:24": ("Apple", "🍎"), "F8:27:93": ("Apple", "🍎"),
    "FC:FC:48": ("Apple", "🍎"),

    # Samsung
    "00:07:AB": ("Samsung", "📱"), "00:12:47": ("Samsung", "📱"), "00:15:B9": ("Samsung", "📱"), "00:16:32": ("Samsung", "📱"),
    "00:17:D5": ("Samsung", "📱"), "00:1A:8A": ("Samsung", "📱"), "00:1C:43": ("Samsung", "📱"), "00:1E:E2": ("Samsung", "📱"),
    "00:21:19": ("Samsung", "📱"), "00:23:39": ("Samsung", "📱"), "00:26:5D": ("Samsung", "📱"), "08:37:3D": ("Samsung", "📱"),
    "14:49:E0": ("Samsung", "📱"), "18:22:7E": ("Samsung", "📱"), "18:83:BF": ("Samsung", "📱"), "24:4B:81": ("Samsung", "📱"),
    "28:98:7B": ("Samsung", "📱"), "30:07:4D": ("Samsung", "📱"), "34:BE:00": ("Samsung", "📱"), "38:0A:94": ("Samsung", "📱"),
    "40:0E:85": ("Samsung", "📱"), "44:80:EB": ("Samsung", "📱"), "48:44:F7": ("Samsung", "📱"), "4C:66:41": ("Samsung", "📱"),
    "50:01:D9": ("Samsung", "📱"), "54:92:BE": ("Samsung", "📱"), "58:C3:8B": ("Samsung", "📱"), "5C:A3:9D": ("Samsung", "📱"),
    "60:A1:0A": ("Samsung", "📱"), "64:1C:B0": ("Samsung", "📱"), "68:EB:AE": ("Samsung", "📱"), "6C:2F:2C": ("Samsung", "📱"),
    "70:2C:1F": ("Samsung", "📱"), "74:45:8A": ("Samsung", "📱"), "78:1F:DB": ("Samsung", "📱"), "7C:38:AD": ("Samsung", "📱"),
    "80:57:19": ("Samsung", "📱"), "84:25:DB": ("Samsung", "📱"), "88:32:9B": ("Samsung", "📱"), "8C:77:12": ("Samsung", "📱"),
    "90:18:7C": ("Samsung", "📱"), "94:63:72": ("Samsung", "📱"), "98:0D:2E": ("Samsung", "📱"), "9C:02:98": ("Samsung", "📱"),
    "A0:0B:BA": ("Samsung", "📱"), "A4:77:33": ("Samsung", "📱"), "A8:06:00": ("Samsung", "📱"), "AC:5F:3E": ("Samsung", "📱"),
    "B0:47:BF": ("Samsung", "📱"), "B4:52:7D": ("Samsung", "📱"), "B8:5E:7B": ("Samsung", "📱"), "BC:72:B7": ("Samsung", "📱"),
    "C0:97:27": ("Samsung", "📱"), "C4:42:02": ("Samsung", "📱"), "C8:14:79": ("Samsung", "📱"), "CC:07:AB": ("Samsung", "📱"),
    "D0:59:E4": ("Samsung", "📱"), "D4:87:D8": ("Samsung", "📱"), "D8:57:EF": ("Samsung", "📱"), "DC:71:44": ("Samsung", "📱"),
    "E0:42:6D": ("Samsung", "📱"), "E4:58:B8": ("Samsung", "📱"), "E8:50:8B": ("Samsung", "📱"), "EC:1F:72": ("Samsung", "📱"),
    "F0:25:B7": ("Samsung", "📱"), "F4:7B:5E": ("Samsung", "📱"), "F8:04:2E": ("Samsung", "📱"), "FC:A1:3E": ("Samsung", "📱"),

    # Xiaomi / Redmi / Poco
    "00:9E:C8": ("Xiaomi", "📱"), "04:CF:8C": ("Xiaomi", "📱"), "0C:1D:AF": ("Xiaomi", "📱"), "10:2A:B3": ("Xiaomi", "📱"),
    "18:59:36": ("Xiaomi", "📱"), "20:34:FB": ("Xiaomi", "📱"), "28:6C:07": ("Xiaomi", "📱"), "34:80:B3": ("Xiaomi", "📱"),
    "38:A4:ED": ("Xiaomi", "📱"), "3C:BD:3E": ("Xiaomi", "📱"), "40:31:3C": ("Xiaomi", "📱"), "50:64:2B": ("Xiaomi", "📱"),
    "58:44:98": ("Xiaomi", "📱"), "58:6B:14": ("Xiaomi", "📱"), "64:CC:2E": ("Xiaomi", "📱"), "68:DF:DD": ("Xiaomi", "📱"),
    "74:23:44": ("Xiaomi", "📱"), "7C:49:EB": ("Xiaomi", "📱"), "80:AD:16": ("Xiaomi", "📱"), "88:C3:97": ("Xiaomi", "📱"),
    "9C:5F:B0": ("Xiaomi", "📱"), "A4:44:D1": ("Xiaomi", "📱"), "AC:C1:EE": ("Xiaomi", "📱"), "B0:1C:0C": ("Xiaomi", "📱"),
    "C4:0B:D4": ("Xiaomi", "📱"), "D4:97:0B": ("Xiaomi", "📱"), "DC:B7:2E": ("Xiaomi", "📱"), "E4:46:DA": ("Xiaomi", "📱"),
    "F8:A4:5F": ("Xiaomi", "📱"), "FC:64:BA": ("Xiaomi", "📱"),

    # Huawei / Honor
    "00:1E:10": ("Huawei", "📱"), "00:25:68": ("Huawei", "📱"), "00:25:9E": ("Huawei", "📱"), "00:46:4B": ("Huawei", "📱"),
    "00:66:4B": ("Huawei", "📱"), "04:25:C5": ("Huawei", "📱"), "08:19:A6": ("Huawei", "📱"), "10:1B:54": ("Huawei", "📱"),
    "18:D0:C5": ("Huawei", "📱"), "20:08:89": ("Huawei", "📱"), "28:31:52": ("Huawei", "📱"), "34:CD:BE": ("Huawei", "📱"),
    "3C:CD:36": ("Huawei", "📱"), "40:4D:8E": ("Huawei", "📱"), "48:46:FB": ("Huawei", "📱"), "4C:1F:CC": ("Huawei", "📱"),
    "54:89:98": ("Huawei", "📱"), "60:E3:27": ("Huawei", "📱"), "70:72:0C": ("Huawei", "📱"), "78:D7:52": ("Huawei", "📱"),
    "80:B6:86": ("Huawei", "📱"), "88:28:B3": ("Huawei", "📱"), "90:4E:91": ("Huawei", "📱"), "9C:C1:72": ("Huawei", "📱"),
    "A4:93:3F": ("Huawei", "📱"), "B4:15:13": ("Huawei", "📱"), "BC:25:E0": ("Huawei", "📱"), "C4:07:2F": ("Huawei", "📱"),
    "D0:2D:B3": ("Huawei", "📱"), "D8:49:0B": ("Huawei", "📱"), "E0:CC:7A": ("Huawei", "📱"), "E8:CD:2D": ("Huawei", "📱"),
    "F4:C7:14": ("Huawei", "📱"), "FC:48:EF": ("Huawei", "📱"),

    # OPPO / Realme / OnePlus
    "00:1F:3B": ("OPPO", "📱"), "14:7D:DA": ("OPPO", "📱"), "20:57:9E": ("Realme", "📱"), "2C:5B:B8": ("OPPO", "📱"),
    "30:75:12": ("OPPO", "📱"), "38:78:62": ("OPPO", "📱"), "44:04:44": ("Realme", "📱"), "50:33:8B": ("OnePlus", "📱"),
    "64:1B:29": ("OPPO", "📱"), "70:1C:E8": ("OPPO", "📱"), "88:12:4E": ("OnePlus", "📱"), "90:7F:61": ("Realme", "📱"),
    "A4:3B:FA": ("OPPO", "📱"), "BC:8C:CD": ("Realme", "📱"), "CC:0D:EC": ("OnePlus", "📱"), "D4:F5:13": ("OPPO", "📱"),
    "E4:0E:EE": ("OPPO", "📱"), "F4:60:E2": ("Realme", "📱"),

    # Vivo / iQOO
    "00:17:7C": ("Vivo", "📱"), "28:FD:80": ("Vivo", "📱"), "34:85:18": ("Vivo", "📱"), "3C:A6:F6": ("Vivo", "📱"),
    "40:2F:86": ("Vivo", "📱"), "50:04:B8": ("Vivo", "📱"), "64:CC:22": ("Vivo", "📱"), "78:23:27": ("Vivo", "📱"),
    "88:40:3B": ("Vivo", "📱"), "98:CD:AC": ("Vivo", "📱"), "A0:86:C6": ("Vivo", "📱"), "C4:BB:4D": ("Vivo", "📱"),

    # Transsion (Infinix, Tecno, Itel)
    "00:18:2D": ("Tecno", "📱"), "18:87:96": ("Infinix", "📱"), "20:B0:01": ("Tecno", "📱"), "2C:22:8B": ("Infinix", "📱"),
    "48:E2:44": ("Transsion", "📱"), "60:83:34": ("Infinix", "📱"), "70:97:56": ("Tecno", "📱"), "80:EA:07": ("Infinix", "📱"),
    "9C:2E:A1": ("Tecno", "📱"), "B4:CD:27": ("Transsion", "📱"), "D8:20:9E": ("Infinix", "📱"), "EC:94:4B": ("Tecno", "📱"),

    # PC / Networking
    "00:15:5D": ("Microsoft", "💻"), "00:50:56": ("VMware", "💻"), "00:1A:A0": ("Dell", "💻"), "18:66:DA": ("Dell", "💻"),
    "00:1E:68": ("HP", "💻"), "2C:4D:54": ("HP", "💻"), "00:21:5C": ("Intel", "💻"), "34:13:E8": ("Intel", "💻"),
    "00:23:CD": ("Lenovo", "💻"), "54:EE:75": ("Lenovo", "💻"), "00:1F:C6": ("ASUS", "💻"), "1C:87:2C": ("ASUS", "💻"),
    "00:1D:7E": ("TP-Link", "📶"), "50:C7:BF": ("TP-Link", "📶"), "E8:48:B8": ("TP-Link", "📶"), "00:0C:42": ("MikroTik", "📶"),
    "04:18:D6": ("Ubiquiti", "📶"), "24:A4:3C": ("Ubiquiti", "📶"), "C0:25:67": ("Tenda", "📶")
}

def get_system_stats():
    global PREV_SYS_NET
    now = time.time()
    cpu_load = "0.0"
    cpu_temp = "-"
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

    # CPU / SoC Temperature
    try:
        for z in ["/sys/class/thermal/thermal_zone0/temp", "/sys/class/hwmon/hwmon0/temp1_input"]:
            if os.path.exists(z):
                with open(z, "r") as f:
                    raw_val = f.read().strip()
                    if raw_val.isdigit():
                        val = int(raw_val)
                        if val > 1000:
                            cpu_temp = f"{val / 1000:.0f}°C"
                        else:
                            cpu_temp = f"{val}°C"
                        break
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
        "cpu_temp": cpu_temp,
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
            if not h or not h.startswith("hostapd."): continue
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
                    
                    oui = mac[:8]
                    vendor_name, vendor_icon = OUI_MAP.get(oui, ("جهاز غير معروف", "📱"))
                    if len(mac) >= 2 and mac[1].upper() in ['2', '6', 'A', 'E']:
                        vendor_name, vendor_icon = ("ماك عشوائي (Private MAC)", "🔒")

                    clients.append({
                        "mac": mac,
                        "signal": sig,
                        "iface": iface_name,
                        "vendor": vendor_name,
                        "vendor_icon": vendor_icon,
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
                            oui = mac[:8]
                            vendor_name, vendor_icon = OUI_MAP.get(oui, ("جهاز غير معروف", "📱"))
                            if len(mac) >= 2 and mac[1].upper() in ['2', '6', 'A', 'E']:
                                vendor_name, vendor_icon = ("ماك عشوائي (Private MAC)", "🔒")
                            clients.append({
                                "mac": mac,
                                "signal": signal,
                                "iface": iface,
                                "vendor": vendor_name,
                                "vendor_icon": vendor_icon,
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
                    if 'Noise:' in line:
                        m = re.search(r'Noise:\s*(-?\d+)\s*dBm', line)
                        if m: iw_data[cur_iface]['noise'] = m.group(1) + ' dBm'
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
            noise = '-'
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
                    if iw_v.get('noise'): noise = iw_v['noise']
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
                carrier = 0
                flags_val = 0
                speed = 0
                duplex = "full"
                try:
                    with open(f"{p_path}/operstate", "r") as f:
                        oper = f.read().strip()
                except Exception:
                    pass
                try:
                    with open(f"{p_path}/carrier", "r") as f:
                        carrier = int(f.read().strip())
                except Exception:
                    pass
                try:
                    with open(f"{p_path}/flags", "r") as f:
                        flags_val = int(f.read().strip(), 16)
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
                
                is_admin_enabled = bool(flags_val & 1) if flags_val > 0 else (oper != "down")
                is_link_up = (carrier == 1) or (oper == "up")

                attached_clients = []
                p_num = p.replace('lan', '')
                if p_num in port_macs:
                    for cmac in port_macs[p_num]:
                        attached_clients.append({
                            "mac": cmac,
                            "ip": arp_map.get(cmac, "")
                        })

                if not is_admin_enabled:
                    speed_str = "معطل برمجياً"
                    status_label = "معطل"
                elif is_link_up:
                    speed_str = f"{speed} Mbps {duplex}" if speed > 0 else "متصل بكابل"
                    status_label = "متصل"
                else:
                    speed_str = "مفعل (لا يوجد كابل)"
                    status_label = "مفعل - بانتظار كابل"

                ports.append({
                    "port": p,
                    "label": p.upper(),
                    "state": oper,
                    "is_enabled": is_admin_enabled,
                    "is_up": is_link_up,
                    "carrier": carrier,
                    "speed": speed if is_link_up else 0,
                    "speed_str": speed_str,
                    "status_label": status_label,
                    "clients": attached_clients
                })
    except Exception:
        pass
    return ports

def ban_mac_locally(mac):
    try:
        # 1. Hardware RF deauth & instant association rejection via hostapd ubus
        out = subprocess.check_output("ubus list | grep hostapd", shell=True, text=True)
        for h in out.splitlines():
            h = h.strip()
            if not h or not h.startswith("hostapd."): continue
            subprocess.run(f"ubus call {h} del_client '{{\"addr\":\"{mac}\", \"ban_time\": 0, \"deauth\": true}}'", shell=True)
        
        # 2. Hardware MAC ACL in Wireless configuration (Drops probe requests & blocks auth)
        try:
            raw_wl = subprocess.check_output("uci -q get wireless.@wifi-iface[0].maclist", shell=True, text=True).strip()
            if mac not in raw_wl:
                subprocess.run("uci -q set wireless.@wifi-iface[0].macfilter='deny'", shell=True)
                subprocess.run(f"uci -q add_list wireless.@wifi-iface[0].maclist='{mac}'", shell=True)
                subprocess.run("uci -q set wireless.@wifi-iface[1].macfilter='deny'", shell=True)
                subprocess.run(f"uci -q add_list wireless.@wifi-iface[1].maclist='{mac}'", shell=True)
                subprocess.run("uci commit wireless", shell=True)
        except Exception:
            pass
        
        # 3. Layer 3 Firewall drop
        subprocess.run(f"iptables -I FORWARD 1 -m mac --mac-source {mac} -j DROP", shell=True)
    except Exception:
        pass

def unban_mac_locally(mac):
    try:
        # 1. Remove from Hardware MAC ACL in Wireless configuration
        try:
            subprocess.run(f"uci -q del_list wireless.@wifi-iface[0].maclist='{mac}'", shell=True)
            subprocess.run(f"uci -q del_list wireless.@wifi-iface[1].maclist='{mac}'", shell=True)
            subprocess.run("uci commit wireless", shell=True)
        except Exception:
            pass

        # 2. Remove Layer 3 Firewall drop
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
            if not h or not h.startswith("hostapd."): continue
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

