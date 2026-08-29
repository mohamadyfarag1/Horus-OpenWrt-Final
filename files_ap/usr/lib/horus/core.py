# -*- coding: utf-8 -*-
import sys
import threading
from .system import get_uci
from .protocol import create_sockets
from .rrm import background_scan_loop
from .root import RootNode
from .satellite import SatelliteNode

def main():
    role = get_uci("horus_controller.main.role", "standalone")
    if role == "standalone":
        sys.exit(0)
    
    secret = get_uci("horus_controller.main.hmp_secret", "")
    grace_period_str = get_uci("horus_controller.main.grace_period", "30")
    controller_ip = get_uci("horus_controller.main.controller_ip", "255.255.255.255")
    
    try: grace_period = int(grace_period_str)
    except: grace_period = 30
    
    raw_sock, udp_sock = create_sockets()
    if not raw_sock and not udp_sock:
        print("Fatal: Could not initialize network sockets.")
        sys.exit(1)

    if role == "root":
        node = RootNode(raw_sock, udp_sock, secret, grace_period)
        threading.Thread(target=background_scan_loop, daemon=True).start()
        threading.Thread(target=node.listen_loop, daemon=True).start()
        node.maintenance_loop()
    elif role == "satellite":
        node = SatelliteNode(raw_sock, udp_sock, secret, controller_ip=controller_ip)
        threading.Thread(target=background_scan_loop, daemon=True).start()
        threading.Thread(target=node.listen_loop, daemon=True).start()
        threading.Thread(target=node.hello_loop, daemon=True).start()
        node.telemetry_loop()
    else:
        sys.exit(0)
