# Ubiquiti airMAX AC Protocol Analysis

## The Nature of airMAX AC
Ubiquiti's airMAX AC is a proprietary Time Division Multiple Access (TDMA) protocol designed to replace the standard Carrier-Sense Multiple Access with Collision Avoidance (CSMA/CA) mechanism used in standard 802.11 WiFi.

### Why Standard Stations Cannot Connect
In standard WiFi (CSMA/CA), nodes "listen" to the medium and transmit when the air is clear. In a heavily loaded network with many clients, this leads to the "Hidden Node Problem," where clients transmit over each other, causing collisions and latency.

To solve this, airMAX AC turns the Access Point into a central "Controller" that assigns specific, dedicated time slots (measured in microseconds) to each Station. A Station is *only* allowed to transmit during its exact allocated timeslot. 

This scheduling logic is heavily embedded within closed-source Ubiquiti binaries (`infctld`, `airviewd`) and a proprietary, heavily modified `mac80211` kernel module. Standard open-source `mac80211` drivers (like those in OpenWrt / Horus) do not possess the ability to interpret these TDMA schedules or sync to the AP's clock, resulting in the AP completely ignoring and rejecting their association requests.

## The airMAX "Mixed Mode" & Backdoor
In the older airMAX M series (802.11n), Ubiquiti provided a Web UI toggle to explicitly disable airMAX, allowing standard WiFi stations to connect. 
However, in the airMAX AC series (802.11ac), Ubiquiti removed this toggle from the UI to enforce a closed ecosystem.

Through reverse-engineering the internal configuration (`/tmp/system.cfg`) of a Rocket AC (XC.v8.7.19), we discovered that the backend configuration variable responsible for this toggle still exists and functions perfectly.

### How to Disable airMAX AC via SSH
To force a Ubiquiti Rocket AC to fall back to standard 802.11ac CSMA/CA (allowing any standard OpenWrt/Horus device to connect), you can disable the hidden polling variable via SSH.

1. SSH into the Rocket AC (Default: `ubnt` / `ubnt`).
2. Run the following commands:
```bash
# Modify the configuration in RAM
sed -i 's/radio.1.polling=enabled/radio.1.polling=disabled/g' /tmp/system.cfg

# Write the changes to the persistent flash (EEPROM/MTD)
cfgmtd -p /etc/ -w

# Reboot the device to apply changes
reboot
```

Upon reboot, the Rocket AC will operate as a standard high-power 802.11ac Access Point, accepting connections from any CSMA/CA compliant Station.
