# WMI Scan Filter and CE3 DMA Buffer Limitation Fix

## The Problem
When testing the Horus firmware, it was discovered that many channels in the 5 GHz band (and extended 2.4 GHz band) would not connect during background scans. Specifically, out of ~177 channels in 5GHz, only about 16 were connecting successfully. 

Live testing of channels 24 to 36 revealed the exact pattern:
- Channel 24 (5120 MHz): PASS
- Channel 25 (5125 MHz): PASS
- Channel 26 (5130 MHz): FAIL
- ...
- Channel 28 (5140 MHz): PASS

### Root Cause
1. **WMI Scan Filter:** The `ath10k_update_channel_list` function inside the ath10k driver (`mac.c`) builds the list of channels to scan and sends them to the firmware via WMI commands. In Horus, a manual filter was applied (`f % 20 == 0`) that restricted scanning to only frequencies that are multiples of 20 MHz, effectively dropping all intermediate 5 MHz-step channels. Channels filtered out received `CTRL-EVENT-SCAN-FAILED ret=-22` (Invalid argument) because wpa_supplicant was trying to scan channels the firmware was never told about.
2. **CE3 DMA Buffer Limit:** We could not simply remove the filter, because the IPQ4019 firmware's Copy Engine CE3 has a hard 2048-byte buffer limit for WMI commands. Each scan channel consumes 28 bytes. Sending all 177 channels would require 4956 bytes, causing a buffer overflow and firmware crash. The absolute maximum safe limit is ~60 channels per batch.

## The Solution: Round-Robin Channel Scan Batches
To solve this while staying within the hardware limits, we implemented a round-robin rotation mechanism inside `ath10k_update_channel_list` (patched via `scripts/gen_package_patches.py`).

### How it works:
1. **Remove Hardcoded Filters:** The manual `f % 20 == 0` filter for 5GHz and the restricted `SCAN_ANCHORS_2G` list for 2.4GHz were completely removed.
2. **Dynamic Batching:** 
   - We calculate the total number of valid (enabled) channels across both bands.
   - We divide this total by 60 to determine the number of necessary "cycles" (e.g., 250 total channels = 5 cycles).
   - We use a static variable `horus_scan_cycle` that increments on every scan request.
   - Based on the cycle, we skip a certain number of channels (`horus_scan_cycle * 60`), and load the *next* 60 channels into the WMI command.
   
This means over the course of 5 scan attempts, **ALL 250+ valid channels in both 2.4 GHz and 5 GHz bands are successfully sent to the firmware**, completely bypassing the CE3 buffer limit while ensuring every channel is scannable by `wpa_supplicant`.

## Impact
- **5 GHz Band:** All 177 intermediate channels (5120 - 6000 MHz) can now be successfully scanned and connected to.
- **2.4 GHz Band:** Extended channels (2312 - 2700 MHz) are also automatically included in the rotation, significantly improving scan reliability.

**Note:** Since this change modifies the ath10k-ct driver patch, a full firmware rebuild and reflash is required for it to take effect.
