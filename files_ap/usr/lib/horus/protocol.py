# -*- coding: utf-8 -*-
import time
import json
import socket
import struct
import hmac
import hashlib
from .config import ETH_P_HMP, UDP_PORT, INTERFACE
from .system import get_my_mac

def compute_hmac(payload_str, secret):
    return hmac.new(secret.encode('utf-8'), payload_str.encode('utf-8'), hashlib.sha256).hexdigest()

def verify_hmac(data_dict, secret):
    if not secret:
        return True
    if 'hmac' not in data_dict:
        return False
    received_hmac = data_dict['hmac']
    data_copy = data_dict.copy()
    del data_copy['hmac']
    payload_str = json.dumps(data_copy, sort_keys=True, separators=(',', ':'))
    computed = compute_hmac(payload_str, secret)
    return hmac.compare_digest(received_hmac, computed)

def mac_str_to_bytes(mac):
    return bytes.fromhex(mac.replace(':', ''))

def create_sockets():
    raw_sock = None
    try:
        raw_sock = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.ntohs(ETH_P_HMP))
        raw_sock.bind((INTERFACE, 0))
    except Exception as e:
        print(f"L2 Raw Socket info: {e}")

    udp_sock = None
    try:
        udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        udp_sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        udp_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        udp_sock.bind(("0.0.0.0", UDP_PORT))
    except Exception as e:
        print(f"L3 UDP Socket info: {e}")

    return raw_sock, udp_sock

def send_hmp_frame(raw_sock, udp_sock, payload_dict, dst_mac="FF:FF:FF:FF:FF:FF", dst_ip="255.255.255.255", secret=""):
    payload_dict['ts'] = int(time.time())
    if secret:
        data_copy = payload_dict.copy()
        payload_str = json.dumps(data_copy, sort_keys=True, separators=(',', ':'))
        payload_dict['hmac'] = compute_hmac(payload_str, secret)
    
    encoded_bytes = json.dumps(payload_dict, separators=(',', ':')).encode('utf-8')
    
    # 1. Send via Layer 2 Raw Ethernet Socket
    if raw_sock:
        try:
            dst_bytes = mac_str_to_bytes(dst_mac if dst_mac and dst_mac != "ALL" else "FF:FF:FF:FF:FF:FF")
            src_bytes = mac_str_to_bytes(get_my_mac())
            eth_type = struct.pack("!H", ETH_P_HMP)
            frame = dst_bytes + src_bytes + eth_type + encoded_bytes
            raw_sock.send(frame)
        except Exception:
            pass

    # 2. Send via Layer 3 UDP Socket
    if udp_sock:
        try:
            target_ip = dst_ip if dst_ip and dst_ip != "0.0.0.0" else "255.255.255.255"
            udp_sock.sendto(encoded_bytes, (target_ip, UDP_PORT))
        except Exception:
            pass

def parse_incoming_data(raw_data, is_l2=True, secret=""):
    try:
        if is_l2:
            if len(raw_data) < 14: return None
            payload_bytes = raw_data[14:]
        else:
            payload_bytes = raw_data
        
        data = json.loads(payload_bytes.decode('utf-8'))
        if secret and not verify_hmac(data, secret):
            return None
        return data
    except Exception:
        return None
