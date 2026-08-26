# 📡 Qualcomm IPQ40xx / QCA4019 Superchannel & Full Spectrum Unlocking Architecture

## 1. Executive Summary
On Qualcomm Atheros IPQ4019 SoC (QCA4019 Dual-Band Radio), Wi-Fi channels and frequencies are controlled by a **4-tier hierarchical validation system**:
1. **Tier 1: Radio Microcode (Firmware level)** -> `firmware-5.bin`
2. **Tier 2: Host Driver** -> `ath10k-ct` (Candela Technologies driver)
3. **Tier 3: Linux Kernel Regulatory Engine** -> `cfg80211` / `mac80211` & `regulatory.db`
4. **Tier 4: User-Space Access Point Daemon** -> `hostapd` / `wpad`

If **ANY** of these 4 tiers blocks a channel or marks it with `NO_IR` (No Initiate Radiation / Passive Scanning only), the frequency will either fail to appear in LuCI, drop transmission power (TxPower) to 0 dBm, or cause the Wi-Fi interface to crash during beacon allocation.

---

## 2. The 4 Tiers of Frequency Enforcement

```
[Tier 1: Hardware Firmware]  --> firmware-5.bin (Candela Tech CT firmware)
                                  - Unlocks physical synthesizer PLL from 4900MHz to 6100MHz
                                  - Enables 10MHz channel spacing (e.g. Channel 146 / 5730MHz)
                                       ↓
[Tier 2: Linux Driver]       --> ath10k-ct (kmod-ath10k-ct)
                                  - Parses WMI channel lists without strict EEPROM masking
                                  - Registers full frequency band array to mac80211
                                       ↓
[Tier 3: Kernel Regulatory]  --> net/wireless/reg.c & ath/regd.c & regulatory.db
                                  - Bypasses `is_valid_rd()` checks
                                  - Sets universal (2192-2732MHz @ 33dBm) & (4900-6100MHz @ 33dBm)
                                  - Strips `NL80211_RRF_NO_IR` and `NL80211_RRF_NO_OFDM`
                                       ↓
[Tier 4: Userspace Daemon]   --> hostapd / wpad-openssl
                                  - Patches `hw_features.c` to prevent OFDM/HT/VHT disabling
                                  - Advertises Beacons with `option country_ie '0'`
```

---

## 3. Detailed Component Breakdown

### A. Firmware Tier (`firmware-5.bin` & `board-2.bin`)
- **Stock Qualcomm Firmware**: Hardcodes standard regulatory channel definitions in its ROM/RAM tables. Non-standard frequencies (e.g., channels between 5720MHz and 5745MHz) are rejected at the WMI command interface level (`WMI_CHANNEL_FLAG`).
- **Candela Technologies CT Firmware (`firmware-5.bin`, API 5)**:
  - Features: `wmi-10.x-CT`, `ratemask-CT`, `regdump-CT`, `ch-regs-CT`.
  - The `ch-regs-CT` feature allows dynamic channel registration across the entire PLL tuning range:
    - **2.4 GHz Band**: 2192 MHz – 2732 MHz (Channels 1 – 14 and beyond)
    - **5 GHz Band**: 4900 MHz – 6100 MHz (Channels 36 – 177 in 10MHz steps: 36, 38, 40, 42 ... 146, 149 ... 177)
  - Location: `/lib/firmware/ath10k/QCA4019/hw1.0/firmware-5.bin` (546,232 bytes, MD5: `5dfb3152796b275349f92684240d9ab4`).

### B. Regulatory Database (`regulatory.db`)
- In Linux 6.x kernels, `cfg80211` queries `/lib/firmware/regulatory.db` (CRDA firmware format).
- A minimal universal unlocked database contains 2 rules applied universally across all ISO country codes:
  ```text
  country 00:
      (2192 - 2732 @ 40), (33)
      (4900 - 6100 @ 160), (33)

  country YE:
      (2192 - 2732 @ 40), (33)
      (4900 - 6100 @ 160), (33)
  ```
- Compiled via `db2fw.py` to produce a clean binary database (900 bytes, MD5: `5a5efbf28f3582a0cfc62472a3b33a5d`).
- Kernel configuration requirements in `.config`:
  ```ini
  CONFIG_KERNEL_CFG80211_REQUIRE_SIGNED_REGDB=n
  CONFIG_KERNEL_CFG80211_CERTIFICATION_ONUS=y
  CONFIG_ATH_USER_REGD=y
  CONFIG_PACKAGE_ATH_USER_REGD=y
  CONFIG_MAC80211_USER_REGD=y
  ```

### C. Kernel Source Code Patches (Linux 6.6 / mac80211-6.12)
1. **`drivers/net/wireless/ath/regd.c`**:
   Expands internal Atheros regulatory mapping tables from default limits to `(4900-10, 6100+10, 160, 0, 33)` and clears `NL80211_RRF_NO_IR` / `NL80211_RRF_NO_OFDM`.
2. **`net/wireless/reg.c`**:
   Bypasses `is_valid_rd()` by injecting `return true;` at function entry. Replaces `NL80211_RRF_NO_IR_ALL` and `NL80211_RRF_NO_IR` with `0`.
3. **`net/wireless/util.c`**:
   Casts channel index `chan = (int)(char)chan;` under `case NL80211_BAND_2GHZ:` to allow signed representation for extended channel numbers > 127 (2.3GHz).
4. **`hostapd/src/ap/hw_features.c`**:
   Prevents hostapd from stripping OFDM/HT/VHT capabilities on extended channels.

---

## 4. Wireless UCI Configuration Best Practices
In `/etc/config/wireless`:
```ini
config wifi-device 'radio1'
    option type 'mac80211'
    option path 'platform/soc/a800000.wifi'
    option channel '146'
    option band '5g'
    option country 'YE'
    option country_ie '0'
    option htmode 'VHT80'
    option txpower '30'
```
> **Key Setting**: `option country_ie '0'` disables the 802.11d Country Information Element in beacon frames. This prevents client devices (smartphones, laptops) from enforcing their own home country channel masks onto the AP link.
