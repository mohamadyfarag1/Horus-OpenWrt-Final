# -*- coding: utf-8 -*-
import time
import select
import threading
import subprocess
from .config import HELLO_INTERVAL, TELEMETRY_INTERVAL
from .system import (
    get_my_mac, get_lan_ip, get_hostname, get_wireless_macs,
    get_wifi_info, ban_mac_locally, unban_mac_locally, apply_wifi_config
)
from .protocol import send_hmp_frame, parse_incoming_data
from .rrm import get_scan_data

class SatelliteNode:
    def __init__(self, raw_sock, udp_sock, secret, controller_ip="255.255.255.255"):
        self.raw_sock = raw_sock
        self.udp_sock = udp_sock
        self.secret = secret
        self.controller_ip = controller_ip if controller_ip else "255.255.255.255"
        self.my_mac = get_my_mac()
        self.hostname = get_hostname()
    
    def send_to_root(self, payload):
        send_hmp_frame(self.raw_sock, self.udp_sock, payload, dst_mac="FF:FF:FF:FF:FF:FF", dst_ip=self.controller_ip, secret=self.secret)

    def hello_loop(self):
        while True:
            try:
                payload = {
                    "type": "hello",
                    "src_mac": self.my_mac,
                    "hostname": self.hostname,
                    "ip": get_lan_ip(),
                    "wifi": get_wifi_info()
                }
                self.send_to_root(payload)
            except Exception:
                pass
            time.sleep(HELLO_INTERVAL)

    def telemetry_loop(self):
        while True:
            try:
                payload = {
                    "type": "telemetry",
                    "src_mac": self.my_mac,
                    "hostname": self.hostname,
                    "ip": get_lan_ip(),
                    "clients": get_wireless_macs(),
                    "scan_data": get_scan_data()
                }
                self.send_to_root(payload)
            except Exception:
                pass
            time.sleep(TELEMETRY_INTERVAL)

    def listen_loop(self):
        sockets = [s for s in [self.raw_sock, self.udp_sock] if s]

        while True:
            try:
                readable, _, _ = select.select(sockets, [], [], 1.0)
                for s in readable:
                    if s == self.raw_sock:
                        raw_frame = s.recv(4096)
                        data = parse_incoming_data(raw_frame, is_l2=True, secret=self.secret)
                    else:
                        udp_data, addr = s.recvfrom(4096)
                        data = parse_incoming_data(udp_data, is_l2=False, secret=self.secret)

                    if not data:
                        continue

                    msg_type = data.get("type", "")
                    target_ap = data.get("target_mac", "").upper()
                    
                    # Destination check
                    if msg_type in ["wifi_config", "ap_manage"]:
                        if target_ap and target_ap != "FF:FF:FF:FF:FF:FF" and target_ap != "ALL" and target_ap != self.my_mac:
                            continue

                    # 1. Ban / Unban
                    if msg_type == "ban":
                        target_client = data.get("target_mac", "").upper()
                        if target_client:
                            ban_mac_locally(target_client)
                    elif msg_type == "unban":
                        target_client = data.get("target_mac", "").upper()
                        if target_client:
                            unban_mac_locally(target_client)

                    # 2. Wi-Fi Config
                    elif msg_type == "wifi_config":
                        action = data.get("action")
                        iface = data.get("iface")
                        value = data.get("value", "")
                        if action and iface:
                            apply_wifi_config(action, iface, value, **data)

                    # 3. AP Hardware Remote Control
                    elif msg_type == "ap_manage":
                        action = data.get("action")
                        
                        if action == "set_ip":
                            ip = data.get("ip")
                            netmask = data.get("netmask")
                            gateway = data.get("gateway")
                            if ip:
                                subprocess.run(f"uci set network.lan.ipaddr='{ip}'", shell=True)
                                if netmask: subprocess.run(f"uci set network.lan.netmask='{netmask}'", shell=True)
                                if gateway: subprocess.run(f"uci set network.lan.gateway='{gateway}'", shell=True)
                                subprocess.run("uci commit network", shell=True)
                                threading.Thread(target=lambda: (time.sleep(2), subprocess.run("/etc/init.d/network restart", shell=True))).start()
                        
                        elif action == "reboot":
                            threading.Thread(target=lambda: (time.sleep(2), subprocess.run("reboot", shell=True))).start()
                        
                        elif action == "kick":
                            cmac = data.get("mac", "")
                            if cmac:
                                try:
                                    out = subprocess.check_output("ubus list | grep hostapd", shell=True, text=True)
                                    for h in out.splitlines():
                                        subprocess.run(f"ubus call {h.strip()} del_client '{{\"addr\":\"{cmac}\"}}'", shell=True)
                                except Exception:
                                    pass
                        
                        elif action == "tx_power":
                            power = data.get("txpower")
                            if power:
                                try:
                                    out = subprocess.check_output("uci -q show wireless", shell=True, text=True)
                                    for line in out.splitlines():
                                        if "wifi-device" in line:
                                            dev = line.split('.')[1].split('=')[0]
                                            subprocess.run(f"uci set wireless.{dev}.txpower='{power}'", shell=True)
                                    subprocess.run("uci commit wireless", shell=True)
                                    subprocess.run("wifi reload", shell=True)
                                except Exception:
                                    pass
                        
                        elif action == "set_hostname":
                            hname = data.get("hostname")
                            if hname:
                                try:
                                    subprocess.run(f"uci set system.@system[0].hostname='{hname}'", shell=True)
                                    subprocess.run("uci commit system", shell=True)
                                    subprocess.run("/etc/init.d/system reload", shell=True)
                                    self.hostname = get_hostname()
                                except Exception:
                                    pass
                        
                        elif action == "wifi_radio":
                            state = str(data.get("state"))
                            if state in ['0', '1']:
                                try:
                                    out = subprocess.check_output("uci -q show wireless", shell=True, text=True)
                                    for line in out.splitlines():
                                        if "wifi-device" in line:
                                            dev = line.split('.')[1].split('=')[0]
                                            subprocess.run(f"uci set wireless.{dev}.disabled='{state}'", shell=True)
                                    subprocess.run("uci commit wireless", shell=True)
                                    subprocess.run("wifi reload", shell=True)
                                except Exception:
                                    pass
                        
                        elif action == "port_state":
                            port = data.get("port")
                            state = data.get("state")
                            if port and state in ['up', 'down']:
                                try:
                                    subprocess.run(f"ip link set {port} {state}", shell=True)
                                except Exception:
                                    pass
            except Exception:
                pass
