# -*- coding: utf-8 -*-
import time
import threading
import subprocess
from .system import get_wireless_macs

SCAN_CACHE = {}
SCAN_LOCK = threading.Lock()

def background_scan_loop():
    global SCAN_CACHE
    while True:
        try:
            # Smart Scanning: Skip if connected clients are present to prevent disruption
            connected = get_wireless_macs()
            if len(connected) > 0:
                time.sleep(120)
                continue
                
            channels = {}
            out = subprocess.check_output("iwinfo | grep -E '^[a-zA-Z0-9_-]+'", shell=True, text=True)
            interfaces = [line.split()[0] for line in out.splitlines() if line.strip()]
            for iface in interfaces:
                try:
                    scan = subprocess.check_output(f"iwinfo {iface} scan", shell=True, text=True)
                    for line in scan.splitlines():
                        if "Channel: " in line:
                            parts = line.split("Channel: ")
                            ch_str = parts[1].split()[0]
                            if ch_str.isdigit():
                                ch = int(ch_str)
                                channels[ch] = channels.get(ch, 0) + 1
                except Exception:
                    pass
            with SCAN_LOCK:
                SCAN_CACHE = channels
        except Exception:
            pass
        time.sleep(300)

def get_scan_data():
    with SCAN_LOCK:
        return SCAN_CACHE.copy()
