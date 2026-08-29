#!/usr/bin/python3
# -*- coding: utf-8 -*-
"""
Horus Central RADIUS Sync Engine (Python 3)
Supports SAS 4, DMA Radius, and ADV Radius with intelligent multi-format MAC & IP matching.
Reports live status: online, offline, disabled.
"""

import os
import sys
import time
import json
import re
import subprocess
import threading
import urllib.parse

JSON_OUT = "/tmp/horus_radius.json"
TOKEN_FILE = "/tmp/sas_token.txt"

def get_uci(option, default=""):
    try:
        out = subprocess.check_output(f"uci -q get horus_controller.main.{option}", shell=True, text=True).strip()
        return out if out else default
    except Exception:
        return default

def normalize_mac(mac):
    if not mac:
        return ""
    clean = re.sub(r'[^A-Fa-f0-9]', '', str(mac)).upper()
    if len(clean) == 12:
        return ":".join(clean[i:i+2] for i in range(0, 12, 2))
    return mac.upper()

def get_arp_table():
    mac_to_ip = {}
    ip_to_mac = {}
    
    if os.path.exists("/proc/net/arp"):
        try:
            with open("/proc/net/arp", "r", encoding="utf-8", errors="ignore") as f:
                for line in f.readlines()[1:]:
                    parts = line.split()
                    if len(parts) >= 4:
                        ip = parts[0]
                        mac = normalize_mac(parts[3])
                        if mac and mac != "00:00:00:00:00:00":
                            mac_to_ip[mac] = ip
                            ip_to_mac[ip] = mac
        except Exception:
            pass

    try:
        out = subprocess.check_output("ip neigh show", shell=True, text=True)
        for line in out.splitlines():
            parts = line.split()
            if len(parts) >= 5 and "lladdr" in parts:
                idx = parts.index("lladdr")
                if idx + 1 < len(parts):
                    ip = parts[0]
                    mac = normalize_mac(parts[idx + 1])
                    if mac:
                        mac_to_ip[mac] = ip
                        ip_to_mac[ip] = mac
    except Exception:
        pass

    return mac_to_ip, ip_to_mac

def get_connected_wifi_macs():
    macs = set()
    
    try:
        out = subprocess.check_output("iwinfo | grep -E '^[a-zA-Z0-9_-]+'", shell=True, text=True)
        for line in out.splitlines():
            iface = line.split()[0]
            try:
                assoc = subprocess.check_output(f"iwinfo {iface} assoclist", shell=True, text=True)
                for m in re.findall(r'(?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}', assoc):
                    macs.add(normalize_mac(m))
            except Exception:
                pass
    except Exception:
        pass

    try:
        out = subprocess.check_output("iw dev", shell=True, text=True)
        for line in out.splitlines():
            if line.strip().startswith("Interface"):
                iface = line.split()[1]
                try:
                    dump = subprocess.check_output(f"iw dev {iface} station dump", shell=True, text=True)
                    for m in re.findall(r'Station\s+((?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2})', dump):
                        macs.add(normalize_mac(m))
                except Exception:
                    pass
    except Exception:
        pass

    try:
        if os.path.exists("/tmp/horus_network_state.json"):
            with open("/tmp/horus_network_state.json", "r") as f:
                state = json.load(f)
                clients = state.get("clients", {})
                for m in clients.keys():
                    macs.add(normalize_mac(m))
    except Exception:
        pass

    return list(macs)

def http_req(url, data=None, headers=None, method=None, timeout=6):
    if headers is None: headers = {}
    import socket, json
    
    if url.startswith("http://"): url = url[7:]
    elif url.startswith("https://"): url = url[8:]
    
    parts = url.split('/', 1)
    host_port = parts[0]
    path = '/' + parts[1] if len(parts) > 1 else '/'
    
    if ':' in host_port:
        host, port = host_port.split(':', 1)
        port = int(port)
    else:
        host = host_port
        port = 80

    if data is not None:
        if isinstance(data, dict):
            payload = json.dumps(data)
            headers['Content-Type'] = 'application/json'
        else:
            payload = str(data)
            if 'Content-Type' not in headers:
                headers['Content-Type'] = 'application/json'
        method = method or 'POST'
    else:
        payload = ""
        method = method or 'GET'

    req = f"{method} {path} HTTP/1.0\r\n"
    req += f"Host: {host}\r\n"
    req += "Connection: close\r\n"
    for k, v in headers.items():
        req += f"{k}: {v}\r\n"
    
    if payload:
        req += f"Content-Length: {len(payload)}\r\n\r\n{payload}"
    else:
        req += "\r\n"

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        s.connect((host, port))
        s.sendall(req.encode('utf-8'))
        
        resp = b""
        while True:
            chunk = s.recv(4096)
            if not chunk: break
            resp += chunk
        s.close()
        
        resp_str = resp.decode('utf-8', errors='ignore')
        if "\r\n\r\n" in resp_str:
            body = resp_str.split("\r\n\r\n", 1)[1]
        else:
            body = resp_str

        if body:
            return json.loads(body)
    except Exception:
        pass
    return None

def write_json_output(records, status="online"):
    try:
        tmp_file = "/tmp/horus_radius.tmp"
        output_payload = {
            "status": status,
            "timestamp": int(time.time()),
            "count": len(records),
            "data": records
        }
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(output_payload, f, ensure_ascii=False)
        os.replace(tmp_file, JSON_OUT)
    except Exception as e:
        pass

# ══════════════════════════════════════════════════════════
# SAS 4 Engine
# ══════════════════════════════════════════════════════════
class SasEngine:
    KEY = "abcdefghijuklmno0123456789012345"

    def __init__(self, base_url, username, password):
        self.base_url = base_url.strip().rstrip("/")
        if not self.base_url.startswith("http://") and not self.base_url.startswith("https://"):
            self.base_url = "http://" + self.base_url
        self.username = username
        self.password = password
        self.token = ""
        self.user_cache = {}

        u = self.base_url
        if u.endswith("/api") or u.endswith("/api/"):
            self.login_url = u.rstrip("/") + "/login"
        elif "/api/" in u:
            self.login_url = u
        else:
            self.login_url = f"{u}/admin/api/index.php/api/login"
        
        self.online_url = self.login_url.replace("/login", "/index/online")
        self.user_url = self.login_url.replace("/login", "/index/user")
        self.overview_base_url = self.login_url.replace("/login", "/user/overview")

    def _encrypt(self, plain_text):
        try:
            cmd = f"printf '%s' '{plain_text}' | openssl enc -aes-256-cbc -md md5 -a -A -k '{self.KEY}'"
            out = subprocess.check_output(cmd, shell=True, text=True).strip()
            return out
        except Exception:
            return None

    def get_token(self, force_refresh=False):
        if self.token and not force_refresh:
            return self.token
        
        if not force_refresh and os.path.exists(TOKEN_FILE):
            try:
                with open(TOKEN_FILE, "r") as f:
                    t = f.read().strip()
                    if t:
                        self.token = t
                        return self.token
            except Exception:
                pass

        payload_plain = json.dumps({"username": self.username, "password": self.password})
        enc = self._encrypt(payload_plain)
        
        resp = None
        if enc:
            resp = http_req(self.login_url, {"payload": enc}, timeout=5)
        if not resp or not resp.get("status"):
            resp = http_req(self.login_url, {"username": self.username, "password": self.password}, timeout=5)

        if resp:
            token = resp.get("token") or (resp.get("data") and resp.get("data", {}).get("token"))
            if token:
                self.token = token
                try:
                    with open(TOKEN_FILE, "w") as f:
                        f.write(token)
                except Exception:
                    pass
                return token

        return None

    def fetch_online_bulk(self, token):
        payload = {"count": 1000}
        headers = {"Authorization": f"Bearer {token}"}
        
        enc = self._encrypt(json.dumps(payload))
        if enc:
            res = http_req(self.online_url, {"payload": enc}, headers=headers, timeout=6)
            if res and res.get("status") in [True, "success", 200, "200"]:
                return res.get("data") or [], True
        
    def fetch_user_info_for_mac(self, mac, token):
        headers = {"Authorization": f"Bearer {token}"}
        
        user_data = None
        uid = ""
        name = ""
        profile = ""
        expiration = ""
        ip = ""
        session = 0
        quota = ""
        balance = ""
        loan = ""
        uname = mac
        
        # 1. Search in /index/online
        payload_online = {"count": 1, "search": mac}
        enc_online = self._encrypt(json.dumps(payload_online))
        if enc_online:
            res = http_req(self.online_url, {"payload": enc_online}, headers=headers, timeout=5)
            if res and isinstance(res, dict) and res.get("data") and len(res["data"]) > 0:
                user_data = res["data"][0]
                ip = user_data.get("framedipaddress") or ""
                session = user_data.get("acctsessiontime") or 0
                uname = user_data.get("username") or mac
                
                ud = user_data.get("user_details") or {}
                # Do NOT use user_data['id'] as uid because it is radacctid!
                uid = ud.get("id", "")
                name = (ud.get("firstname", "") + " " + (ud.get("lastname", "") or "")).strip()
                profile = user_data.get("user_profile_name", "") or ud.get("profile_details", {}).get("name", "")
                expiration = ud.get("expiration", "")
                balance = ud.get("balance", "")
                loan = ud.get("loan_balance", "")

        # 2. If no valid user ID or missing details, search in /index/user
        if not uid or str(uid) == "null" or not name:
            payload_user = {"count": 1, "search": mac}
            enc_user = self._encrypt(json.dumps(payload_user))
            if enc_user:
                res = http_req(self.user_url, {"payload": enc_user}, headers=headers, timeout=5)
                if res and isinstance(res, dict) and res.get("data") and len(res["data"]) > 0:
                    ud = res["data"][0]
                    if ud:
                        uid = ud.get("id", "")
                        if not uname or uname == mac:
                            uname = ud.get("username", mac)
                        if not name:
                            name = (ud.get("firstname", "") + " " + (ud.get("lastname", "") or "")).strip() or ud.get("username", "")
                        if not profile:
                            prof_det = ud.get("profile_details") or {}
                            profile = prof_det.get("name", "")
                        if not expiration:
                            expiration = ud.get("expiration", "")
                        if not balance:
                            balance = ud.get("balance", "")
                        if not loan:
                            loan = ud.get("loan_balance", "")

        # 3. If still no UID, try lowercase mac in /index/user
        if not uid and mac != mac.lower():
            payload_user = {"count": 1, "search": mac.lower()}
            enc_user = self._encrypt(json.dumps(payload_user))
            if enc_user:
                res = http_req(self.user_url, {"payload": enc_user}, headers=headers, timeout=5)
                if res and isinstance(res, dict) and res.get("data") and len(res["data"]) > 0:
                    ud = res["data"][0]
                    if ud:
                        uid = ud.get("id", "")
                        if not uname or uname == mac:
                            uname = ud.get("username", mac)
                        if not name:
                            name = (ud.get("firstname", "") + " " + (ud.get("lastname", "") or "")).strip() or ud.get("username", "")
                        if not profile:
                            prof_det = ud.get("profile_details") or {}
                            profile = prof_det.get("name", "")
                        if not expiration:
                            expiration = ud.get("expiration", "")
                        if not balance:
                            balance = ud.get("balance", "")
                        if not loan:
                            loan = ud.get("loan_balance", "")

        # 4. Fetch overview (for real-time remaining quota & balance)
        if uid and str(uid) != "null":
            ov_url = f"{self.overview_base_url}/{uid}"
            res = http_req(ov_url, headers=headers, timeout=5)
            if res and isinstance(res, dict) and res.get("data"):
                od = res.get("data") or {}
                quota = od.get("remaining_rxtx", "") or quota
                if not name:
                    name = (od.get("firstname", "") + " " + (od.get("lastname", "") or "")).strip() or od.get("username", "")
                if not profile:
                    profile = od.get("profile_name", "")
                if not expiration:
                    expiration = od.get("expiration", "")
                if not balance or balance == "0.00" or balance == 0:
                    balance = od.get("balance", balance)
                if not loan:
                    loan = od.get("loan_balance", loan)

        if not name and not profile and not ip and not uid:
            return None
            
        return {
            "mac": mac,
            "name": name or uname,
            "profile": profile,
            "expiration": expiration,
            "quota": quota,
            "balance": str(balance) if (balance is not None and balance != "") else "0.00",
            "loan": str(loan) if loan is not None else "",
            "ip": ip,
            "session": session,
            "username": uname
        }

    def sync(self, connected_macs, mac_to_ip, ip_to_mac):
        token = self.get_token()
        if not token:
            token = self.get_token(force_refresh=True)
            if not token:
                return [], "offline"

        results = []
        lock = threading.Lock()

        def _process_mac(mac):
            try:
                res = self.fetch_user_info_for_mac(mac, token)
                if res:
                    self.user_cache[mac] = {'data': res, 'ts': time.time()}
                    with lock:
                        results.append(res)
                elif mac in self.user_cache and (time.time() - self.user_cache[mac]['ts']) < 180:
                    with lock:
                        results.append(self.user_cache[mac]['data'])
            except Exception:
                if mac in self.user_cache and (time.time() - self.user_cache[mac]['ts']) < 180:
                    with lock:
                        results.append(self.user_cache[mac]['data'])

        threads = []
        for mac in connected_macs:
            t = threading.Thread(target=_process_mac, args=(mac,))
            threads.append(t)
            t.start()
            if len(threads) >= 5:
                for t in threads:
                    t.join()
                threads = []

        for t in threads:
            t.join()

        for r in results:
            r.pop("uid", None)

        return results, "online"

# ══════════════════════════════════════════════════════════
# DMA Radius Engine
# ══════════════════════════════════════════════════════════
class DmaEngine:
    def __init__(self, base_url, username, password, api_key):
        self.base_url = base_url.strip().rstrip("/")
        if not self.base_url.startswith("http://") and not self.base_url.startswith("https://"):
            self.base_url = "http://" + self.base_url
        if not self.base_url.endswith(".php"):
            self.url = f"{self.base_url}/user_api.php"
        else:
            self.url = self.base_url
        self.username = username
        self.password = password
        self.key = api_key or "Mohamady_Radius_2026"

    def sync(self, connected_macs, mac_to_ip, ip_to_mac):
        params = urllib.parse.urlencode({
            "key": self.key,
            "admin_user": self.username,
            "admin_pass": self.password,
            "action": "online"
        })
        full_url = f"{self.url}?{params}"
        res = http_req(full_url, timeout=5)
        if not res or not isinstance(res, dict) or "data" not in res:
            return [], "offline"
        
        online_list = res.get("data", [])
        if not isinstance(online_list, list):
            online_list = []

        # If online_list has users, fetch their balances & detailed quotas via batch_overview in 1 batch query
        usernames = [u.get("username") for u in online_list if u.get("username")]
        if usernames:
            try:
                ov_params = urllib.parse.urlencode({
                    "key": self.key,
                    "admin_user": self.username,
                    "admin_pass": self.password,
                    "action": "batch_overview",
                    "users": json.dumps(usernames)
                })
                ov_res = http_req(f"{self.url}?{ov_params}", timeout=5)
                if ov_res and isinstance(ov_res, dict) and "data" in ov_res:
                    ov_data = ov_res.get("data", {})
                    for item in online_list:
                        u_name = item.get("username")
                        if u_name and u_name in ov_data and ov_data[u_name]:
                            u_ov = ov_data[u_name]
                            if "balance" in u_ov:
                                item["balance"] = u_ov["balance"]
                            if "remaining_traffic_bytes" in u_ov and u_ov["remaining_traffic_bytes"] is not None:
                                item["remainingTrafficBytes"] = u_ov["remaining_traffic_bytes"]
            except Exception:
                pass

        online_by_mac = {}
        online_by_ip = {}
        for item in online_list:
            m = normalize_mac(item.get("mac") or item.get("normalized_mac") or item.get("callingstationid") or "")
            if m:
                online_by_mac[m] = item
            u_mac = normalize_mac(item.get("username") or "")
            if u_mac:
                online_by_mac[u_mac] = item
            ip = item.get("ip") or item.get("framedipaddress") or ""
            if ip:
                online_by_ip[ip] = item

        results = []
        for mac in connected_macs:
            ip = mac_to_ip.get(mac, "")
            user = online_by_mac.get(mac) or (online_by_ip.get(ip) if ip else None)
            if user:
                quota = user.get("remainingTrafficBytes")
                if quota is None:
                    quota = user.get("remaining_bytes") or user.get("quota") or ""

                results.append({
                    "mac": mac,
                    "name": user.get("name") or user.get("firstname") or user.get("username") or "",
                    "profile": user.get("profile_name") or user.get("profile") or user.get("srvname") or "",
                    "expiration": user.get("expiration") or "",
                    "quota": quota,
                    "balance": str(user.get("balance") or user.get("credits") or user.get("money") or "0"),
                    "loan": str(user.get("loan_balance") or user.get("loan") or ""),
                    "ip": user.get("ip") or user.get("framedipaddress") or ip,
                    "session": int(user.get("uptime") or user.get("session") or 0),
                    "username": user.get("username") or mac
                })
        return results, "online"

# ══════════════════════════════════════════════════════════
# ADV Radius Engine
# ══════════════════════════════════════════════════════════
class AdvEngine:
    def __init__(self, base_url, username, password, api_key):
        self.base_url = base_url.strip().rstrip("/")
        if not self.base_url.startswith("http://") and not self.base_url.startswith("https://"):
            self.base_url = "http://" + self.base_url
        self.base_url = re.sub(r'/login(\.php)?$', '', self.base_url)
        self.username = username
        self.password = password
        self.api_key = api_key
        self.token = ""

    def get_token(self):
        import hashlib
        md5_pass = hashlib.md5(self.password.encode('utf-8')).hexdigest()
        payload = {
            "username": self.username,
            "password": md5_pass,
            "password_plain": self.password,
            "master_key": self.api_key
        }
        res = http_req(f"{self.base_url}/login", payload, timeout=5)
        if res:
            self.token = res.get("token") or (res.get("data") and res.get("data", {}).get("token")) or ""
        return self.token

    def sync(self, connected_macs, mac_to_ip, ip_to_mac):
        if not self.token:
            self.get_token()
        if not self.token:
            return [], "offline"

        headers = {"Authorization": f"Bearer {self.token}"}
        res = http_req(f"{self.base_url}/get_online_users", {}, headers=headers, timeout=5)
        if not res or not isinstance(res, dict) or "data" not in res:
            self.token = ""
            return [], "offline"

        online_list = res.get("data", [])
        online_by_mac = {}
        online_by_ip = {}
        for item in online_list:
            m = normalize_mac(item.get("mac") or item.get("callingstationid") or "")
            if m:
                online_by_mac[m] = item
            ip = item.get("ip") or item.get("framedipaddress") or ""
            if ip:
                online_by_ip[ip] = item

        results = []
        for mac in connected_macs:
            ip = mac_to_ip.get(mac, "")
            user = online_by_mac.get(mac) or (online_by_ip.get(ip) if ip else None)
            if user:
                results.append({
                    "mac": mac,
                    "name": user.get("name") or user.get("username") or "",
                    "profile": user.get("profile") or "",
                    "expiration": user.get("expiration") or "",
                    "quota": user.get("quota") or "",
                    "balance": str(user.get("balance") or user.get("credit") or ""),
                    "loan": str(user.get("loan_balance") or user.get("loan") or ""),
                    "ip": user.get("ip") or ip,
                    "session": int(user.get("session") or 0),
                    "username": user.get("username") or mac
                })
        return results, "online"

# ══════════════════════════════════════════════════════════
# Main Daemon Loop
# ══════════════════════════════════════════════════════════
def main():
    while True:
        try:
            enabled = get_uci("enabled", "0")
            if enabled == "1":
                rtype = get_uci("radius_type", "sas")
                base_url = get_uci("base_url")
                username = get_uci("username")
                password = get_uci("password")
                api_key = get_uci("api_key")
                interval = int(get_uci("sync_interval", "10") or 10)
                if interval < 3:
                    interval = 5

                if base_url and username:
                    mac_to_ip, ip_to_mac = get_arp_table()
                    connected_macs = get_connected_wifi_macs()

                    records = []
                    status = "online"
                    if rtype == "sas":
                        engine = SasEngine(base_url, username, password)
                        records, status = engine.sync(connected_macs, mac_to_ip, ip_to_mac)
                    elif rtype == "dma":
                        engine = DmaEngine(base_url, username, password, api_key)
                        records, status = engine.sync(connected_macs, mac_to_ip, ip_to_mac)
                    elif rtype == "adv":
                        engine = AdvEngine(base_url, username, password, api_key)
                        records, status = engine.sync(connected_macs, mac_to_ip, ip_to_mac)

                    write_json_output(records, status=status)
                else:
                    write_json_output([], status="disabled")
                
                time.sleep(interval)
            else:
                write_json_output([], status="disabled")
                time.sleep(10)
        except Exception as e:
            write_json_output([], status="offline")
            time.sleep(10)

if __name__ == "__main__":
    main()
