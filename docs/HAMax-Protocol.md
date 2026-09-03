# 📡 HAMax — Horus Long-Range 5 GHz Profile

**Status:** implemented, `files_ap/usr/bin/hamax` (v3)
**Scope:** the 5 GHz radio only. The 2.4 GHz radio is never read, written or reloaded.

---

## 1. What HAMax is, in one paragraph

HAMax is a **tuning profile**, not a protocol. It configures the 5 GHz radio for
long-range point-to-point and point-to-multipoint links using the knobs that
mac80211 / ath10k-ct / hostapd actually expose, records every change so it can be
undone exactly, and reports honestly which of those knobs the running build
supports. There is no handshake, no negotiation, and no new frame format. Two
HAMax devices are two independently tuned radios speaking ordinary 802.11.

---

## 2. Why this is not airMAX — and what that costs

This matters more than any feature list, so it comes first.

### How airMAX actually works

Ubiquiti airMAX replaces 802.11's contention-based medium access with a
**proprietary TDMA polling scheme**. The AP hands each client a transmit slot and
tells it when its turn is; clients never contend for the medium. Ubiquiti's own
material describes it as a TDMA protocol that "dynamically allocates time to
active clients" with better noise immunity than CSMA/CA, plus "smart polling"
that prioritises voice and video.

The consequence that people notice is a side effect, not a feature: **a standard
802.11 client cannot connect to an airMAX AP because it cannot participate in the
polling scheme at all.** It is not an access-control list rejecting them. The
medium access is simply a different protocol. The same is true of MikroTik
Nstreme/Nv2 and LigoWave iPoll — all mutually incompatible, and all incompatible
with plain 802.11.

### What we can and cannot reproduce

| airMAX mechanism | Reproducible on IPQ4019 + ath10k-ct? |
|---|---|
| TDMA slot scheduling | ❌ **No.** ath10k has no slot scheduler, and one cannot be added from userspace. The firmware does not expose it. |
| Non-airMAX clients cannot associate | ❌ **No** — that is a consequence of TDMA, which we do not have. |
| Non-standard channel widths (10/30/50/60 MHz) | ❌ **No.** OpenWrt wires `chanbw` only to ath9k/ath5k; ath10k 5/10 MHz support is unimplemented ([ath10k-ct#53](https://github.com/greearb/ath10k-ct/issues/53)). |
| Off-grid centre frequencies → invisible to stock clients | ✅ **Yes.** This is the mechanism HAMax uses. See §4. |
| Per-station airtime arbitration | ⚠️ **Partly.** hostapd airtime policy weights airtime fairly, but the link stays CSMA/CA. |
| Long-range ACK timeout / slot time | ✅ **Yes** — `distance`. |
| Transparent L2 bridging | ✅ **Yes** — WDS 4-address. |

**The honest summary:** HAMax reduces contention and its cost. It does not remove
contention, because removing it requires TDMA. Anyone promising otherwise on this
chipset is describing something the hardware cannot do.

---

## 3. What HAMax actually applies

All of these are real OpenWrt / mac80211 / hostapd options, applied only to the
5 GHz `wifi-device` and the `wifi-iface`s attached to it.

### Radio level (`wifi-device`)

| Option | Purpose |
|---|---|
| `distance` | **The single most important long-range knob.** Sizes ACK timeout and slot time to the propagation delay. Too low drops frames; too high wastes airtime. Must be set on *both* ends — it is a local PHY property, not negotiated. |
| `rts` | Hidden-node mitigation on a PtMP cell, where client A cannot hear client B. Disabled for PtP. |
| `noscan` | Stops 20/40 coexistence from narrowing the channel. |
| `legacy_rates 0` + `cell_density 0` | OFDM only; stops the rate controller sliding to slow legacy rates. |
| `short_gi_20/40/80` | ~11% throughput. May be unstable on very long, reflective paths. |
| `beacon_int` | Default 100. Lowering it costs airtime without helping data latency on a fixed link. |
| `txpower` | Optional; still bounded by the regulatory database. |
| `channel` / `htmode` | Optional, from the unlocked plan. See §4. |

### Interface level (`wifi-iface`)

| Option | Purpose |
|---|---|
| `wds 1` | Transparent 4-address L2 bridging — the open equivalent of what Ubiquiti and MikroTik do. |
| `mcast_rate` | Lifts multicast/broadcast off the 6 Mbit/s floor. On a PtMP cell those frames dominate airtime because they go at the slowest rate. |
| `basic_rate` | High basic rate set (54000 for PtP, 24000+54000 for PtMP). |
| `dtim_period 1` | Low latency; fixed CPEs have no battery to save. |
| `disassoc_low_ack 0` | Do not drop a marginal CPE over a few missed ACKs. |
| `hidden 1` | Stealth mode only. Weak alone — see §4. |
| `hostapd_options` | `vendor_elements`, `airtime_*`, `uapsd_advertisement_enabled=0`. |

### AP vs Station — what each side gets

The station runs `wpa_supplicant`, not `hostapd`, so hostapd-side features do not
exist there. This is a hard boundary, not an omission:

| | AP (tower) | Station (CPE) |
|---|:---:|:---:|
| `distance`, `rts`, `noscan`, `short_gi` | ✅ | ✅ |
| `wds`, `mcast_rate`, `basic_rate` | ✅ | ✅ |
| `dtim_period`, `disassoc_low_ack` | ✅ | ❌ |
| Vendor IE, airtime fairness, stealth | ✅ | ❌ |

---

## 4. Spectrum: the one real invisibility mechanism

### The channel plan

The superchannel work (see `skills/01-superchannel-architecture.md`) registers a
**10 MHz-spaced table of 68 channels spanning 5180–5885 MHz** in
`ath10k_5ghz_channels[]`. `HAMAX_CHANS` in the engine mirrors `CHANS` in
`scripts/gen_package_patches.py` — **if you change one, change the other.**

```
freq = 5000 + 5 × channel
36,38,40 … 146   |   149,151 … 165   |   169,173,177
```

### On-grid vs off-grid

A stock 802.11 client scans by tuning its receiver to each **standard 20 MHz
centre** in turn:

```
36 40 44 48 | 52 56 60 64 | 100 104 … 144 | 149 153 157 161 165     (25 channels)
```

The other **43 channels in the plan are off-grid**. A phone or laptop never parks
its receiver on 5190 MHz (channel 38) or 5885 MHz (channel 177) during a scan, so
it never receives the beacon and the network does not appear in its list *at all*.
Channels 169/173/177 sit above the standard band entirely; channels 68–98
(5340–5490 MHz) fall in a range not allocated to Wi-Fi in any normal regulatory
domain.

**This is the closest honest analogue to airMAX invisibility available here.** It
is the same category of trick — operate where standard gear does not look — even
though the specific means (centre frequency rather than channel width) differs.

### What stealth mode does and does not do

`stealth 1` sets `hidden 1` (`ignore_broadcast_ssid`). **On its own this is weak:**
the SSID still appears in association exchanges, and any scanner sees the BSSID.
It is only meaningful stacked on an off-grid channel. The engine logs a warning if
stealth is enabled while the radio sits on a standard centre.

### What none of this is

Off-grid + hidden SSID makes a network **hard to find**. It does not make it
**hard to join** for anyone who does find it. The 5 GHz SSID in this image ships
with `encryption 'none'`. Access control needs:

- `encryption 'psk2'` + a key — the actual mechanism
- `macfilter 'allow'` + `list maclist` — explicit device list
- `maxassoc` — hard cap on associated stations

The HAMax vendor IE is an **identifier, not a gate**. 802.11 requires stations to
ignore elements they do not understand, so a device with no HAMax profile still
sees and still associates with an on-grid, unencrypted HAMax network.

---

## 5. Design rules the engine follows

These exist because the previous implementation violated all four.

1. **Never write a hostapd directive without checking the binary carries it.**
   hostapd treats an unknown config line as fatal, so injecting `airtime_mode`
   into a `wpad-basic` build takes the 5 GHz radio down. The engine greps the
   actual binary and skips (and reports) what is absent.
2. **Never report a request as a result.** Capability badges and channel states
   reflect what the running build offers. Channel state is three-valued —
   `usable` / `unavailable` / `unknown` — because "could not ask" is not "not
   supported"; collapsing them would show a stock 25-channel image as a full
   68-channel one.
3. **Back up before writing, restore exactly.** Every change is recorded in
   `/etc/hamax/backup.uci` first. `disable` restores prior values and *deletes*
   options that did not exist before, rather than substituting defaults.
4. **Committing UCI is not applying it.** Every apply reloads the 5 GHz
   `wifi-device` via netifd. The 2.4 GHz radio is not reloaded.

---

## 6. PtP / PtMP

A **tuning preset, not an association limit.** Selecting PtP does not stop a
second station from associating; it tells HAMax to tune on the assumption of a
single peer:

| | PtMP | PtP |
|---|---|---|
| `rts` | 512 | disabled |
| Airtime fairness | on | off |
| `basic_rate` | 24000, 54000 | 54000 |

To actually cap the count, use `maxassoc` and a `maclist` in
`/etc/config/wireless`. An operator who reads "point to point" as "one device
only" ends up running a multi-client cell with exactly the arbitration that cell
needs switched off — which is why the UI says so at the point of choice.

---

## 7. Exclusion without a password or a MAC list

A common requirement is "keep other gear off my link, but I do not want a
passphrase and I do not want to maintain a MAC list". The off-grid channel is
exactly that mechanism, and it is the only one here that works without either.

**How it excludes.** A device can only associate with a network it can hear.
Hearing it requires tuning the receiver to the right centre frequency. A stock
client only ever tunes to the 25 standard centres while scanning. Park the link
on one of the other 43 and it is not "hidden from" those devices — it is outside
the set of frequencies they will ever look at. No key exchange is involved, so
there is nothing to configure on either side beyond the channel.

**Who can still see it.** Anything that scans the extended plan: another Horus
unit with the same superchannel patches (intended — this is how your own CPEs
associate), Ubiquiti gear in site-survey mode, a spectrum analyser, or any radio
deliberately told to tune there. Off-grid defeats *stock* equipment, not a
determined operator with the right hardware.

**What it does not do.** It does not encrypt. Traffic on an open off-grid link is
in the clear to anyone who does tune there. If the requirement is confidentiality
rather than exclusion, only encryption provides it.

| Goal | Off-grid channel | Hidden SSID | WPA2 | MAC list |
|---|:---:|:---:|:---:|:---:|
| Stock clients cannot find the network | ✅ | ⚠️ partial | ❌ | ❌ |
| No passphrase to distribute | ✅ | ✅ | ❌ | ✅ |
| No per-device list to maintain | ✅ | ✅ | ✅ | ❌ |
| Traffic is confidential | ❌ | ❌ | ✅ | ❌ |

---

## 8. Knowing it actually works

Two commands, and they answer different questions.

`hamax check` — **can this build do it?** Reads the hostapd binary and the phy:
which directives exist, how many of the 68 channels the driver registers.

`hamax verify` — **is it doing it right now?** Reads back from the live system
only: the running phy, the netdev, the radio survey, and the hostapd config file
netifd generated. Nothing comes from `/etc/config`. A setting can be present in
UCI and absent on the radio — hostapd refused it, the driver ignored it, the
radio never reloaded — and that gap is precisely what this exposes.

```
--- hostapd config in use (/var/run/hostapd-phy1.conf) ---
  ✓ vendor_elements=dd06000789010101
  ✓ airtime_mode=2
  ✓ ignore_broadcast_ssid=1
  · wds_sta: not present
```

A `✓` means hostapd parsed that line and is running with it. An airtime weight
appearing in `iw station dump` is proof the scheduler is live, because mac80211
only reports it when the policy is actually running.

### The live panel

The dashboard shows what the hardware measures on the channel in use:

| Field | Source | Meaning |
|---|---|---|
| Noise floor | `iw survey dump` | Receiver noise. Lower is better. |
| Channel utilisation | survey busy ÷ active | How much of the air is occupied — **including other people's traffic and interference**, not just yours. This is the honest version of an "airtime" readout. |
| TX / RX time | survey | How much of that is you. |
| SNR | station signal − noise floor | The number that actually predicts link health. |
| Retry % | tx retries ÷ (retries + packets) | Rising retries mean the rate controller is fighting the channel. |
| Link quality | derived from SNR and retry % | A presentation of the two above. |

**On "CCQ".** Ubiquiti's CCQ is a proprietary figure computed inside airOS. It is
not reproducible and is not reproduced. The quality percentage here is derived
from SNR and retry rate — both measured by mac80211 — and is labelled as such. It
is a useful comparative indicator between stations on the same radio; it is not
Ubiquiti's number and should not be compared against one.

---

## 9. What improves, and what does not

### Improves

- **Range and stability** — `distance` sizes ACK timeout to the path. Without it, a
  long link silently drops frames the radio thinks were never acknowledged.
- **PtMP fairness** — airtime policy stops one distant, slow CPE from consuming the
  airtime of every other client.
- **Hidden-node collisions** — RTS/CTS on a PtMP cell.
- **Airtime waste** — multicast lifted off 6 Mbit/s, OFDM-only rates, no 20/40
  coexistence downgrade.
- **Transparent bridging** — WDS 4-address.
- **Discoverability** — off-grid centres remove the link from stock scans.
- **Observability** — SNR, utilisation, retries, and live verification.

### Does not improve

- **Raw throughput on a clean, short link.** If SNR is high and the channel is
  quiet, the radio is already at its ceiling; nothing here raises it.
- **Contention itself.** The link stays CSMA/CA. Airtime policy divides the airtime
  more fairly; it does not create more of it or eliminate collisions. That needs
  TDMA.
- **Latency floor.** Beacon and DTIM tuning do not reduce per-packet latency on an
  established link in any meaningful way.
- **Interference.** Nothing here removes a competing signal. High channel
  utilisation from someone else's traffic is solved by changing channel — which is
  what the 68-channel plan is for.
- **Security.** See §7.
- **2.4 GHz.** Out of scope by design.

---

## 10. Command reference

```bash
hamax enable      # apply the profile to the 5 GHz radio
hamax disable     # restore the radio exactly as it was
hamax apply       # re-apply (used after a settings save)
hamax status      # full state as JSON
hamax telemetry   # refresh /tmp/hamax.json
hamax channels    # the 68-channel plan with per-channel driver state
hamax check       # capability + channel-plan report — run this first
hamax log-clear
```

`hamax check` is the diagnostic that answers "why is this feature not doing
anything on my box".

### Files

| Path | Role |
|---|---|
| `/etc/config/hamax` | settings |
| `/etc/hamax/backup.uci` | pre-HAMax values (persistent — do not delete while enabled) |
| `/etc/hamax/since` | activation timestamp |
| `/tmp/hamax.json` | live state + telemetry for the UI |
| `/tmp/hamax.log` | event log, self-trimming |

---

## 11. Build requirements

| Requirement | Why | Where |
|---|---|---|
| `wpad-mbedtls` (full) | `wpad-basic` has no `CONFIG_AIRTIME_POLICY`; airtime fairness is absent and injecting it would down the radio | `config/horus.config` |
| Superchannel patches | Without them the driver registers 25 channels, not 68, and every off-grid channel is refused | `scripts/07-unlock-superchannel.sh`, `scripts/10-gen-package-patches.sh` |
| Unlocked `regulatory.db` | Otherwise cfg80211 masks the extended frequencies | `scripts/09-generate-regdb.sh` |
| `country_ie 0` | Stops clients pushing their home channel mask onto the link | `/etc/config/wireless` |

If the image is built without the superchannel patches, HAMax still works — it
simply refuses off-grid channels and says so in `hamax check`.

---

## 12. Sources

- [What exactly is airMAX? — Ubiquiti Community](https://community.ui.com/questions/What-exactly-is-airMAX/30b23a00-2fd3-44c3-9842-9e36afcf28b8)
- [airMAX TDMA Technology Datasheet](https://dl.ubnt.com/datasheets/airmax/UBNT_DS_airMAX_TDMA.pdf)
- [802.11 non-standard equipment — Wikipedia](https://en.wikipedia.org/wiki/802.11_non-standard_equipment)
- [ISP Wireless — Guide to Channel Width Selection, UISP](https://help.uisp.com/hc/en-us/articles/22590865994775-ISP-Wireless-Guide-to-Channel-Width-Selection)
- [Limitations when using airMAX Mixed Mode — HostiFi](https://support.hostifi.com/en/articles/6310556-limitations-when-using-airmax-mixed-mode)
- [Options and current state of 5MHz and 10MHz channel widths — ath10k-ct#53](https://github.com/greearb/ath10k-ct/issues/53)
- [OpenWrt `mac80211.sh`](https://github.com/openwrt-mirror/openwrt/blob/master/package/kernel/mac80211/files/lib/netifd/wireless/mac80211.sh)
