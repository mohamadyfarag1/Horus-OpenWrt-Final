# Rocket Prism 5AC Gen2 Interoperability & 6100 MHz SuperChannel

## Executive Summary
This document records the comprehensive reverse-engineering of the live **Ubiquiti Rocket Prism 5AC Gen2** (`192.168.22.77`, running airOS `XC.v8.7.22`) and establishes the technical specifications for Horus firmware to achieve 100% frequency alignment, seamless airMAX AC Mixed Mode association, and high-speed bidirectional throughput.

---

## 1. Live Rocket Prism 5AC Gen2 Extraction & Analysis

### Hardware & Environment
- **Device Model**: Rocket Prism 5AC Gen2 (`RP-5AC-Gen2`, FCC ID: `SWX-RP5ACG2`)
- **System IP**: `192.168.22.77` (Bridge `br0` on subnet `192.168.22.0/24`)
- **airOS Firmware**: `XC.v8.7.22` (Kernel `2.6.32.68` on `QCA955x` MIPS 74Kc)
- **Active SSID**: `"RedaNet-Elsawy1"` (BSSID: `B4:FB:E4:BE:D5:D4`)
- **Operating Frequencies**: Control `5885 MHz` (Channel 177), Center `5895 MHz` (`11acvht40`, 40 MHz)
- **Security**: WPA2-PSK CCMP, Key: `963852147`

### Critical airOS Kernel & TDMA Parameters Discovered
From live kernel extraction (`system.cfg`, `/etc/sysinit/radio.conf`, `/proc/sys/dev/uph_wifi0/netconf`):
1. `radio.1.polling=enabled`: Ubiquiti airMAX proprietary polling engine active (`ubnt_poll_host.ko`).
2. `radio.1.polling_11ac_11n_compat=1`: **airMAX Mixed Mode compatibility active**.
3. `radio.1.polling_ff_flex=1`: Flexible frame duration (adapts slot times dynamically).
4. `wireless.1.wds.status=enabled`: WDS 4-address bridging active on the AP.
5. `wireless.1.ampdu.frames=32`, `wireless.1.amsdu=1`: Hardware frame aggregation enabled.
6. `radio.1.countrycode=511`: Licensed / Compliance Test mode unlocking channels from 4.920 GHz to 6.100 GHz.
7. `flags: 137, cbp_dur: 180, cbp_usable_dur: 200`: In Mixed Mode, the Rocket allocates a Contention-Based Period (`cbp_dur`) within each TDMA frame for CSMA/CA fallback and non-airMAX frames.

### Proof of 11n / Non-AC Interoperability
Live connected stations dumped via `wstalist` include:
- `NanoBeam M5 16` (`04:18:D6:5C:44:90`, airOS `XW.v6.3.12`, IP: `192.168.21.19`): Connected with MCS rate 162/90 Mbps.
- `NanoBeam M5 16` (`04:18:D6:5C:46:29`, airOS `XW.v6.3.12`, IP: `192.168.21.8`): Connected with MCS rate 162/81.5 Mbps.
- `NanoStation 5AC loco` (`68:D7:9A:92:0D:75`, airOS `WA.v8.7.12`, IP: `192.168.109.200`).

Both airMAX M5 (802.11n) and airMAX AC stations connect simultaneously to this Rocket!

---

## 2. The 6100 MHz SuperChannel Spectrum Plan (Combined Total = 255)

The live Rocket Prism supports channels extending from 4.920 GHz up to **6.100 GHz (Channel 220)** in 5 MHz increments.

### Hardware & Driver Constraint: `ATH10K_NUM_CHANS <= 255`
In `ath10k-ct` (smallbuffers variant), survey structures use a `u8` channel index. The total number of channels across 2.4 GHz and 5 GHz must strictly not exceed 255:
Total Channels = N_5GHz + N_2.4GHz <= 255

### The Exact Mathematical Allocation:
1. **5 GHz Plan: Channels 24 to 220 (5120 MHz to 6100 MHz)**
   - Frequency: Freq = 5000 + 5 * Channel
   - Step: 5 MHz continuous
   - Channel Count: 220 - 24 + 1 = 197 channels
   - Covers 100% of the Rocket Prism's operational band up to 6.100 GHz (Channel 220).

2. **2.4 GHz Plan: 58 Channels (2312 MHz to 2592 MHz)**
   - **NanoStation M2 2.3 GHz Sub-band**: Channels 237 to 256 (2312 - 2407 MHz) = 20 channels
   - **Standard 2.4 GHz ISM**: Channels 1 to 13 (2412 - 2472 MHz) = 13 channels
   - **Standard 802.11b Japan**: Channel 14 (2484 MHz) = 1 channel
   - **Transition Band**: Channels 74 to 80 (2477 - 2507 MHz, 5 MHz step) = 7 channels
   - **Upper 2.5 GHz Band**: Channels 15 to 31 (2512 - 2592 MHz, 5 MHz step) = 17 channels
   - Subtotal 2.4 GHz = 20 + 13 + 1 + 7 + 17 = 58 channels.

3. **Total Combined Channels**:
   197 + 58 = 255 channels (<= 255 hard limit, 0 compiler warnings, 0 overflow).

---

## 3. Analysis: The Client Mode Behavior & Throughput Asymmetry

### Symptom 1: Plain Client Mode Dropping Power to 0 dBm
- **Cause**: In standard OpenWrt mac80211, attaching an 802.11 client (`mode=sta`) to a network bridge (`br-lan`) without 4-address mode (`wds 1`) triggers `BRIDGE_NOT_ALLOWED` in `hostapd.sh`. `netifd` immediately destroys the virtual interface `wlan0`, leaving the PHY unconfigured (power = 0 dBm).
- **Solution (Commit `6d5f138`)**: In `hostapd.sh` and `mac80211.sh`, when `mode='sta'` is joined to a bridge, Horus automatically promotes `wds=1` (4-address mode). The interface is never torn down and power stays locked at full 30 dBm.

### Symptom 2: Client WDS Download ~700 Mbps, Upload ~0 Mbps
Two interrelated factors caused this asymmetry:
1. **Layer-2 Switching Loop / Broadcast Storm**:
   When Horus was connected to the Rocket via Wi-Fi (`wlan0` in `br-lan`) while ALSO connected via Ethernet cable to the same local switch (`eth0` in `br-lan`), an unmanaged bridge loop was formed between Horus (`br-lan`) and Rocket (`br0`). Broadcast frames (ARP, DHCP) circulated at gigabit speeds, generating a broadcast storm that consumed 100% of the station's uplink airtime. Unicast upload packets were completely starved.
2. **airMAX Mixed Mode TDMA Contention**:
   Under `radio.1.polling=enabled` with `compat=1`, the Rocket AP transmits downlink frames freely according to its schedule, while uplink transmission requires either an airMAX TDMA polling slot or transmission during the Contention-Based Period (`cbp_dur: 180 us`).
   Without the proper Ubiquiti airMAX signature injected at association, the Rocket places the station on the deferred list, restricting uplink burst capability.

### Resolution & Best Practices:
1. **Physical Isolation**: Never connect both Ethernet and Client WDS to the same physical switch without STP enabled or VLAN isolation.
2. **Transparent Bridge vs Routed Client Configuration**:
   - **Option A (Transparent Bridge / CPE Station)**:
     - Disable DHCP server on Horus: `uci set dhcp.lan.ignore=1; uci commit dhcp; /etc/init.d/dnsmasq restart`.
     - Set Horus LAN IP to a static IP on the Rocket subnet (e.g. `192.168.22.78`, Gateway `192.168.22.1`, DNS `8.8.8.8`).
     - This allows PC connected to Horus LAN to receive DHCP directly from the main network without conflict.
   - **Option B (Routed Client / Wireless WAN)**:
     - Assign `wlan0` to `network 'wan'` instead of `lan`.
     - Horus receives an IP via DHCP client from the Rocket on `wan`.
     - Horus NATs/routes its local LAN (`192.168.100.1`), completely preventing any possibility of Ethernet loops.

---

## 4. Horus airMAX Stability & Zero-Freeze Verification

The previous Horus airMAX freeze issue has been completely identified and resolved:
1. **Decoupled Radios**: HAMax operates strictly on the 5 GHz radio. It never touches or restarts 2.4 GHz.
2. **Apply Guard**: If `enabled=0`, the configuration scripts exit cleanly in `< 5 ms` without calling `wifi reload`.
3. **20 MHz Auto-Clamping on Channels >= 180**: Prevents hostapd from crashing on channels 180..220 where 40/80 MHz secondary channels do not exist.
4. **Kernel Buffer Sizing**: Kernel network buffers scaled to safe, bounded limits (`rmem_max=4MB`, `wmem_max=4MB`, `netdev_max_backlog=5000`), leaving `147+ MB` free RAM and CPU load at `0.64`.
