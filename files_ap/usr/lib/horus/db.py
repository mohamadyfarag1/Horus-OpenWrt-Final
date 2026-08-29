# -*- coding: utf-8 -*-
import os
import json
import threading

class HorusDB:
    def __init__(self, db_path="/tmp/horus_db.json"):
        self.db_path = db_path
        self.lock = threading.Lock()
        self.state = {
            "aps": {},
            "clients": {},
            "banned": [],
            "logs": [],
            "my_mac": "",
            "settings": {}
        }
        self.load()

    def load(self):
        try:
            if os.path.exists(self.db_path):
                with open(self.db_path, "r") as f:
                    self.state = json.load(f)
        except Exception:
            pass

    def save(self):
        try:
            tmp = self.db_path + ".tmp"
            with open(tmp, "w") as f:
                json.dump(self.state, f)
            os.replace(tmp, self.db_path)
        except Exception:
            pass

    def update_ap(self, mac, hostname, ip, last_seen, wifi_info, scan_data, ports=None):
        with self.lock:
            if mac not in self.state["aps"]:
                self.state["aps"][mac] = {"clients": []}
            ap = self.state["aps"][mac]
            ap["hostname"] = hostname
            ap["ip"] = ip
            ap["last_seen"] = last_seen
            if wifi_info:
                ap["wifi"] = wifi_info
            if ports:
                ap["ports"] = ports
            ap["scan_data"] = scan_data
            self.save()

    def add_log(self, event_type, mac, details, now):
        if "logs" not in self.state:
            self.state["logs"] = []
        self.state["logs"].insert(0, {
            "type": event_type,
            "mac": mac,
            "details": details,
            "timestamp": int(now)
        })
        self.state["logs"] = self.state["logs"][:100]

    def update_clients(self, ap_mac, clients_list, now):
        with self.lock:
            # Clear old clients for this AP
            self.state["aps"][ap_mac]["clients"] = clients_list
            
            for c in clients_list:
                mac = c.get("mac", "").upper()
                if not mac: continue
                
                banned = False
                suspicious_since = 0
                ban_expires = 0
                
                if mac in self.state["clients"]:
                    old_c = self.state["clients"][mac]
                    banned = old_c.get("banned", False)
                    ban_expires = old_c.get("ban_expires", 0)
                    old_ap = old_c.get("ap_mac", "")
                    
                    if not banned and old_ap and old_ap != ap_mac:
                        # If seen on old AP within 8s, mark as concurrent presence (suspicious)
                        if (now - old_c.get("last_seen", 0)) < 8:
                            suspicious_since = old_c.get("suspicious_since", 0)
                            if suspicious_since == 0:
                                suspicious_since = now
                                self.add_log("spoof_warning", mac, f"ظهور متزامن على {old_ap} و {ap_mac} (بدء مهلة التحقق)", now)
                        else:
                            # Normal roam (old AP has naturally released the client)
                            self.add_log("roam", mac, f"تنقل سلس من {old_ap} إلى {ap_mac}", now)
                            suspicious_since = 0
                
                self.state["clients"][mac] = {
                    "ap_mac": ap_mac,
                    "signal": c.get("signal", -100),
                    "iface": c.get("iface", ""),
                    "last_seen": now,
                    "suspicious_since": suspicious_since,
                    "banned": banned,
                    "ban_expires": ban_expires
                }
            self.save()

    def get_all_state(self):
        with self.lock:
            return self.state.copy()

    def cleanup_stale(self, ap_timeout, client_timeout, now):
        unbanned = []
        with self.lock:
            my_mac = self.state.get("my_mac", "")
            
            # APs
            stale_aps = []
            for mac, ap in self.state["aps"].items():
                if mac != my_mac and (now - ap.get("last_seen", 0)) > ap_timeout:
                    stale_aps.append(mac)
            for mac in stale_aps:
                del self.state["aps"][mac]
                
            # Clients
            stale_clients = []
            for mac, c in self.state["clients"].items():
                if not c.get("banned") and (now - c.get("last_seen", 0)) > client_timeout:
                    stale_clients.append(mac)
            for mac in stale_clients:
                del self.state["clients"][mac]
                
            # Bans
            expired_bans = []
            for b in self.state["banned"]:
                if 0 < b.get("expires", 0) < now:
                    expired_bans.append(b["mac"])
                    unbanned.append(b["mac"])
                    
            self.state["banned"] = [b for b in self.state["banned"] if b["mac"] not in expired_bans]
            
            for mac in unbanned:
                if mac in self.state["clients"]:
                    self.state["clients"][mac]["banned"] = False
                    self.state["clients"][mac]["ban_expires"] = 0
                    
            self.save()
        return unbanned

    def get_suspicious_clients(self, grace_period, now):
        with self.lock:
            return [mac for mac, c in self.state["clients"].items() 
                    if not c.get("banned") and c.get("suspicious_since", 0) > 0 
                    and (now - c["suspicious_since"]) >= grace_period]

    def ban_client(self, mac, reason, duration, now):
        expires = now + duration if duration > 0 else 0
        with self.lock:
            # Remove existing ban if any
            self.state["banned"] = [b for b in self.state["banned"] if b["mac"] != mac]
            self.state["banned"].append({
                "mac": mac,
                "reason": reason,
                "banned_at": now,
                "duration": duration,
                "expires": expires
            })
            if mac in self.state["clients"]:
                self.state["clients"][mac]["banned"] = True
                self.state["clients"][mac]["ban_expires"] = expires
            self.add_log("ban", mac, reason, now)
            self.save()

    def unban_client(self, mac):
        with self.lock:
            self.state["banned"] = [b for b in self.state["banned"] if b["mac"] != mac]
            if mac in self.state["clients"]:
                self.state["clients"][mac]["banned"] = False
                self.state["clients"][mac]["ban_expires"] = 0
            self.add_log("unban", mac, "تم فك الحظر اليدوي", self.state.get("router_time", 0))
            self.save()

    def get_ap_ip(self, mac):
        with self.lock:
            if mac in self.state["aps"]:
                return self.state["aps"][mac].get("ip", "255.255.255.255")
            return "255.255.255.255"

    def get_all_aps(self):
        with self.lock:
            return list(self.state["aps"].keys())

    def set_my_mac(self, mac):
        with self.lock:
            self.state["my_mac"] = mac
            self.save()
