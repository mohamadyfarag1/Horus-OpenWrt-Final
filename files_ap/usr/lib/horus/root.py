# -*- coding: utf-8 -*-
import os
import time
import json
import select
import threading
from .config import (
    STATE_FILE, BAN_CMD_FILE, WIFI_CMD_FILE, AP_CMD_FILE,
    AP_DEAD_TIMEOUT
)
from .system import (
    get_my_mac, get_lan_ip, get_hostname, get_wireless_macs,
    get_wifi_info, get_ethernet_ports, get_system_stats, get_uci,
    ban_mac_locally, unban_mac_locally, apply_wifi_config,
    steer_client_locally, enable_80211kv_locally
)
from .protocol import send_hmp_frame, parse_incoming_data
from .rrm import get_scan_data
from .db import HorusDB

class RootNode:
    def __init__(self, raw_sock, udp_sock, secret, grace_period):
        self.raw_sock = raw_sock
        self.udp_sock = udp_sock
        self.secret = secret
        self.grace_period = grace_period
        self.my_mac = get_my_mac()
        
        self.db = HorusDB()
        self.db.set_my_mac(self.my_mac)
        
        self.rrm_counter = 0
        self.lock = threading.Lock()
    
    def send_cmd(self, payload, dst_mac="FF:FF:FF:FF:FF:FF", dst_ip="255.255.255.255"):
        send_hmp_frame(self.raw_sock, self.udp_sock, payload, dst_mac=dst_mac, dst_ip=dst_ip, secret=self.secret)

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
                        if data and "ip" not in data:
                            data["ip"] = addr[0]

                    if not data:
                        continue

                    src_mac = data.get("src_mac", "").upper()
                    if not src_mac or src_mac == self.my_mac:
                        continue

                    msg_type = data.get("type", "")
                    now = time.time()

                    if msg_type == "hello":
                        with self.lock:
                            self.db.update_ap(
                                mac=src_mac,
                                hostname=data.get("hostname", "unknown"),
                                ip=data.get("ip", ""),
                                last_seen=now,
                                wifi_info=data.get("wifi", []),
                                scan_data={},
                                ports=data.get("ports", [])
                            )
                    elif msg_type == "telemetry":
                        clients = data.get("clients", [])
                        scan_data = data.get("scan_data", {})
                        with self.lock:
                            self.db.update_ap(
                                mac=src_mac,
                                hostname=data.get("hostname", "Horus-AP"),
                                ip=data.get("ip", ""),
                                last_seen=now,
                                wifi_info=data.get("wifi", []),
                                scan_data=scan_data,
                                ports=data.get("ports", []),
                                stats=data.get("stats", {})
                            )
                            self.db.update_clients(src_mac, clients, now)
                            self.handle_anti_spoofing(now)
            except Exception:
                pass

    def handle_anti_spoofing(self, now):
        # Fetch clients that have exceeded the grace period
        suspicious_macs = self.db.get_suspicious_clients(self.grace_period, now)
        for cmac in suspicious_macs:
            self.db.ban_client(cmac, "تكرار ماك وسرقة (MAC Spoofing)", 0, now)
            ban_mac_locally(cmac)
            self.send_cmd({"type": "ban", "src_mac": self.my_mac, "target_mac": cmac, "duration": 0})

    def maintenance_loop(self):
        loop_tick = 0
        while True:
            try:
                time.sleep(1)
                now = time.time()
                loop_tick += 1

                with self.lock:
                    # 1. Register Root as an AP with live telemetry and stats
                    own_clients = get_wireless_macs()
                    self.db.update_ap(
                        mac=self.my_mac,
                        hostname=get_hostname(),
                        ip=get_lan_ip(),
                        last_seen=now,
                        wifi_info=get_wifi_info(),
                        scan_data=get_scan_data(),
                        ports=get_ethernet_ports(),
                        stats=get_system_stats()
                    )
                    self.db.update_clients(self.my_mac, own_clients, now)
                    self.handle_anti_spoofing(now)
                    
                    # 2. Cleanup stale APs, Clients, and Expired Bans
                    unbanned_macs = self.db.cleanup_stale(AP_DEAD_TIMEOUT, 60, now)
                    for cmac in unbanned_macs:
                        unban_mac_locally(cmac)
                        self.send_cmd({"type": "unban", "src_mac": self.my_mac, "target_mac": cmac})

                # 3. Auto-Channel (RRM) every 60s
                self.rrm_counter += 1
                if self.rrm_counter >= 12:
                    self.rrm_counter = 0
                    auto_2g = get_uci("horus_controller.main.auto_ch_2g", "0")
                    auto_5g = get_uci("horus_controller.main.auto_ch_5g", "0")
                    
                    if auto_2g == "1" or auto_5g == "1":
                        with self.lock:
                            full_state = self.db.get_all_state()
                            for ap_mac, ap_data in full_state["aps"].items():
                                scan = ap_data.get("scan_data", {})
                                wifi_list = ap_data.get("wifi", [])
                                for wifi in wifi_list:
                                    ch_str = str(wifi.get("channel", "0"))
                                    try: current_ch = int(ch_str)
                                    except: current_ch = 0
                                    
                                    is_2g = 0 < current_ch <= 14
                                    is_5g = current_ch >= 36
                                    
                                    if (is_2g and auto_2g == "1") or (is_5g and auto_5g == "1"):
                                        allowed = [1, 6, 11] if is_2g else [36, 40, 44, 48, 149, 153, 157, 161]
                                        best_ch = allowed[0]
                                        min_inf = 9999
                                        for c in allowed:
                                            inf = scan.get(str(c), 0)
                                            if inf < min_inf:
                                                min_inf = inf
                                                best_ch = c
                                                
                                        if best_ch != current_ch and current_ch in allowed:
                                            if ap_mac == self.my_mac:
                                                apply_wifi_config("set_channel", wifi["iface"], str(best_ch))
                                            else:
                                                target_ip = ap_data.get("ip", "255.255.255.255")
                                                self.send_cmd({
                                                    "type": "wifi_config",
                                                    "src_mac": self.my_mac,
                                                    "target_mac": ap_mac,
                                                    "iface": wifi["iface"],
                                                    "action": "set_channel",
                                                    "value": str(best_ch)
                                                }, dst_mac=ap_mac, dst_ip=target_ip)

                # 4. Smart Roaming & Min-RSSI Steering (Every 5 seconds)
                if loop_tick % 5 == 0:
                    roaming_en = get_uci("horus_controller.main.roaming_enabled", "1")
                    if roaming_en == "1":
                        try:
                            min_rssi = int(get_uci("horus_controller.main.min_rssi", "-75"))
                        except Exception:
                            min_rssi = -75

                        with self.lock:
                            all_clients = self.db.get_all_state().get("clients", {})
                            for cmac, cinfo in all_clients.items():
                                if cinfo.get("banned"): continue
                                cur_sig = cinfo.get("signal", -100)
                                cur_ap = cinfo.get("ap_mac", "")

                                # If client signal drops below Min-RSSI floor
                                if cur_sig < min_rssi and cur_sig > -100:
                                    last_steer = cinfo.get("last_steer_time", 0)
                                    if (now - last_steer) > 15:
                                        cinfo["last_steer_time"] = now
                                        if cur_ap == self.my_mac:
                                            steer_client_locally(cmac, ban_time=3000)
                                        else:
                                            target_ip = self.db.get_ap_ip(cur_ap)
                                            self.send_cmd({
                                                "type": "ap_manage",
                                                "src_mac": self.my_mac,
                                                "target_mac": cur_ap,
                                                "action": "steer_client",
                                                "mac": cmac,
                                                "ban_time": 3000
                                            }, dst_mac=cur_ap, dst_ip=target_ip)
                                        self.db.add_log("steer", cmac, f"توجيه ذكي ونقل للعميل لضعف الإشارة ({cur_sig} dBm < {min_rssi} dBm)", now)

                # 4. Check Pending Ban Commands
                if os.path.exists(BAN_CMD_FILE):
                    try:
                        with open(BAN_CMD_FILE, "r") as f:
                            cmd = json.load(f)
                        os.remove(BAN_CMD_FILE)
                        action = cmd.get("action")
                        cmac = cmd.get("mac", "").upper()
                        duration = cmd.get("duration", 0)
                        target_aps = cmd.get("target_aps", cmd.get("scope", "all"))
                        
                        with self.lock:
                            if action == "ban":
                                self.db.ban_client(cmac, "manual", duration, now)
                                if target_aps == "all" or self.my_mac in target_aps or not target_aps:
                                    ban_mac_locally(cmac)
                                
                                if target_aps == "all":
                                    self.send_cmd({"type": "ban", "src_mac": self.my_mac, "target_mac": cmac, "duration": duration})
                                elif isinstance(target_aps, list):
                                    for ap_target in target_aps:
                                        ap_target = str(ap_target).upper()
                                        if ap_target != self.my_mac:
                                            target_ip = self.db.get_ap_ip(ap_target)
                                            self.send_cmd({"type": "ban", "src_mac": self.my_mac, "target_mac": cmac, "duration": duration}, dst_mac=ap_target, dst_ip=target_ip)
                            elif action == "unban":
                                self.db.unban_client(cmac)
                                ban_mac_locally(cmac) # Ensure cleanup
                                unban_mac_locally(cmac)
                                self.send_cmd({"type": "unban", "src_mac": self.my_mac, "target_mac": cmac})
                    except Exception:
                        pass
                
                # 5. Check Pending Wi-Fi Commands
                if os.path.exists(WIFI_CMD_FILE):
                    try:
                        with open(WIFI_CMD_FILE, "r") as f:
                            cmd = json.load(f)
                        os.remove(WIFI_CMD_FILE)
                        target_ap = cmd.get("target_ap", "")
                        iface = cmd.get("iface", "wlan0")
                        action = cmd.get("action", "")
                        value = cmd.get("value", "")
                        
                        cmd["src_mac"] = self.my_mac
                        cmd["type"] = "wifi_config"
                        
                        if isinstance(target_ap, list):
                            for ap in target_ap:
                                ap = ap.upper()
                                if ap == self.my_mac:
                                    apply_wifi_config(action, iface, value, **cmd)
                                else:
                                    target_ip = self.db.get_ap_ip(ap)
                                    cmd_copy = cmd.copy()
                                    cmd_copy["target_mac"] = ap
                                    self.send_cmd(cmd_copy, dst_mac=ap, dst_ip=target_ip)
                        else:
                            target_ap = str(target_ap).upper()
                            if target_ap == self.my_mac:
                                apply_wifi_config(action, iface, value, **cmd)
                            elif target_ap == "ALL":
                                apply_wifi_config(action, iface, value, **cmd)
                                cmd["target_mac"] = "ALL"
                                self.send_cmd(cmd)
                            else:
                                target_ip = self.db.get_ap_ip(target_ap)
                                cmd["target_mac"] = target_ap
                                self.send_cmd(cmd, dst_mac=target_ap, dst_ip=target_ip)
                    except Exception:
                        pass
                
                # 6. Check Pending AP Remote Control Commands (Reboot, IP, Hostname, LAN Ports)
                if os.path.exists(AP_CMD_FILE):
                    try:
                        with open(AP_CMD_FILE, "r") as f:
                            cmd = json.load(f)
                        os.remove(AP_CMD_FILE)
                        target_ap = cmd.get("target_ap", "")
                        cmd["src_mac"] = self.my_mac
                        cmd["type"] = "ap_manage"
                        
                        # Check if Root itself is in the target list
                        if cmd.get("action") == "admin_password":
                            new_pw = cmd.get("password")
                            is_target = (target_ap == "ALL" or (isinstance(target_ap, list) and self.my_mac in target_ap) or target_ap == self.my_mac)
                            if new_pw and is_target:
                                subprocess.run(f"printf '{new_pw}\\n{new_pw}\\n' | passwd root", shell=True)

                        if isinstance(target_ap, list):
                            for ap in target_ap:
                                ap = ap.upper()
                                target_ip = self.db.get_ap_ip(ap)
                                cmd_copy = cmd.copy()
                                cmd_copy["target_mac"] = ap
                                self.send_cmd(cmd_copy, dst_mac=ap, dst_ip=target_ip)
                        else:
                            target_ap = str(target_ap).upper()
                            if target_ap == "ALL":
                                cmd["target_mac"] = "ALL"
                                self.send_cmd(cmd)
                            elif target_ap:
                                target_ip = self.db.get_ap_ip(target_ap)
                                cmd["target_mac"] = target_ap
                                self.send_cmd(cmd, dst_mac=target_ap, dst_ip=target_ip)
                    except Exception:
                        pass
                
                # 7. Write Network State File (Compatibility Layer for UI CGI)
                with self.lock:
                    state = self.db.get_all_state()
                    state["router_time"] = int(now)
                    try:
                        tmp_state = STATE_FILE + ".tmp"
                        with open(tmp_state, "w") as f:
                            json.dump(state, f)
                        os.replace(tmp_state, STATE_FILE)
                    except Exception:
                        pass

            except Exception:
                pass
