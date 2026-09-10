# Horus SuperChannel Architecture (ath10k / QCA4019)

## 1. The WMI Copy Engine Buffer Limit (The 60-Channel Ceiling)
The Qualcomm Atheros IPQ4019 firmware uses a Copy Engine (CE3) for Host-to-Target WMI commands. This buffer is strictly limited to 2048 bytes.
When injecting custom SuperChannels (e.g., 2312-2732 MHz in 2.4GHz, and 4920-6100 MHz in 5GHz), the total number of registered channels reaches over 300. 
Passing all these channels to the firmware via `WMI_SCAN_CHAN_LIST_CMD` requires ~6900 bytes, which silently overflows the target SRAM, triggering a watchdog reboot loop (`crash -108`).

### The Solution: Smart Round-Robin Batching
Instead of sending all 300+ channels at once, we patched `ath10k_update_channel_list` in the kernel driver to slice the global channel list into 60-channel batches (~1680 bytes, safely under the 2048-byte limit). 
Every time a hardware scan is requested, the driver dynamically rotates to the next batch of 60 channels and updates the firmware.

## 2. Active Scan Dropping During Association
When a device operating in Station mode attempts to associate, `wpa_supplicant` asks the driver to perform an active scan on a *specific* frequency (e.g., 2692 MHz).
Because the firmware's allowed scan list was rotating blindly, there was an 80% chance the requested frequency was **not** in the current 60-channel window, causing the firmware to silently drop the scan request and fail the connection.

### The Solution: Active Scan Injection
We modified `ath10k_hw_scan` to pass the user's requested channels (`req->channels`) directly into `ath10k_update_channel_list`. 
The rotation logic was patched to prioritize and protect these specifically requested channels, ensuring they are always injected into the active 60-channel batch sent to the firmware.

## 3. Firmware Channel Number Collisions (Management Frame Drops)
The most obscure bug was that Horus devices could act as APs on 2.6-2.7 GHz, but client devices failed to connect because management frames were being dropped by the driver.
The firmware tracks channels internally by mathematically deriving a channel number from the frequency (e.g., `(freq - 2407) / 5`). 
For a 2.4GHz SuperChannel like 2692 MHz, this calculation yielded `57`. 
In the `ath10k_wmi_event_mgmt_rx` event handler, the driver checked if the channel number was between 16 and 237, and if so, incorrectly classified the frame as a `5GHz` frame. 
Since `mac80211` was expecting a 2.4GHz management frame, it dropped the "5GHz" frame, completely breaking association.

### The Solution: `phy_mode` Band Classification
We rewrote the band classification logic in `ath10k_wmi_event_mgmt_rx`. Instead of relying on the mathematically colliding channel number, the driver now prioritizes the `phy_mode` field provided in the WMI event header. 
By checking for modes like `MODE_11G`, `MODE_11B`, or `MODE_11NG_HT20`, the driver correctly tags SuperChannel management frames as 2.4GHz, regardless of the arbitrary channel number assigned by the firmware.
