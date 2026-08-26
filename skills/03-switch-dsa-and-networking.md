# 🔌 Network Subsystem, DSA Switch (QCA8k), and Multi-Core SMP IRQ Affinity

## 1. Distributed Switch Architecture (DSA) on IPQ4019
In Linux 6.x / OpenWrt 24.10, the legacy `swconfig` architecture has been completely replaced by **DSA (Distributed Switch Architecture)**:
- The internal switch is a **Qualcomm QCA8337 / QCA8075** variant driven by `drivers/net/dsa/qca/qca8k-ipq4019.c`.
- The switch communicates with the CPU's Ethernet DMA controller (`ipqess-edma c080000.ethernet eth0`) via a high-speed **PSGMII** (Penta Serial Gigabit Media Independent Interface) bus operating at 6.25 Gbps.

---

## 2. The PSGMII Calibration Issue & Technical Solution

### Root Cause
During soft reboots or warm restarts, the hardware VCO (Voltage-Controlled Oscillator) on the PSGMII link retains residual state. When the `qca8k` driver reinitializes, it enters a calibration loop that retries up to 100 times (`retries < 100`):
```c
/* drivers/net/dsa/qca/qca8k-ipq4019.c */
do {
    qca8k_read(priv, QCA8K_REG_PSGMII_CALB, &val);
    if (val & QCA8K_PSGMII_CALB_DONE)
        break;
    mdelay(10);
} while (retries++ < 100);
```
If calibration hangs or takes excessive iterations, the switch driver stalls the entire network stack for up to 1–2 minutes, resulting in:
- LAN ports not responding on boot.
- LuCI web UI inaccessible without multiple hard power cycles.

### Permanent Patch Solution
During kernel preparation in `scripts/06-compile.sh`, the retry limit is patched to 1 immediate attempt:
```bash
for f in $(find build_dir/ -path "*/drivers/net/dsa/qca/qca8k*c" 2>/dev/null); do
    sed -i 's/retries < 100/retries < 1/g' "$f"
    sed -i 's/retries < 10 /retries < 1 /g' "$f"
done
```
This forces the driver to immediately accept the active link state without stalling, bringing LAN ports up within 1 second of kernel boot.

---

## 3. Dynamic Consecutive MAC Address Assignment
To ensure compliance with IEEE 802.3 and prevent BSSID collision between the 2.4GHz radio, 5GHz radio, WAN port, and LAN bridge, consecutive MACs are calculated dynamically at first boot:

```bash
# /etc/uci-defaults/99-fix-macs
BASE_MAC=$(cat /sys/class/net/eth0/address 2>/dev/null)
if [ -n "$BASE_MAC" ]; then
    prefix=$(echo "$BASE_MAC" | cut -d: -f1-5)
    last_byte=$(echo "$BASE_MAC" | cut -d: -f6)

    # Base MAC -> LAN Bridge (br-lan)
    # Base + 1 -> WAN Interface (eth0 / wan)
    # Base + 2 -> 2.4 GHz Wi-Fi Radio (radio0)
    # Base + 3 -> 5.0 GHz Wi-Fi Radio (radio1)
    WAN_MAC="${prefix}:$(printf "%02x" $(((0x$last_byte + 1) % 256)))"
    WLAN2_MAC="${prefix}:$(printf "%02x" $(((0x$last_byte + 2) % 256)))"
    WLAN5_MAC="${prefix}:$(printf "%02x" $(((0x$last_byte + 3) % 256)))"

    uci set network.lan.macaddr="$BASE_MAC"
    uci set network.wan.macaddr="$WAN_MAC"
    uci set wireless.default_radio0.macaddr="$WLAN2_MAC"
    uci set wireless.default_radio1.macaddr="$WLAN5_MAC"
    uci commit
fi
```

---

## 4. Multi-Core SMP IRQ Affinity Optimization
The IPQ4019 has 4 CPU cores (`cpu0`, `cpu1`, `cpu2`, `cpu3`). By default, all hardware interrupts are routed to `cpu0`, creating a bottleneck during gigabit routing or heavy Wi-Fi traffic.

### Solution via `/etc/rc.local`:
```bash
# 1. Force CPU governor to Performance
for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
    echo "performance" > $cpu 2>/dev/null
done

# 2. Pin 2.4G Wi-Fi IRQ to CPU Core 1 (smp_affinity mask 2)
# 3. Pin 5.0G Wi-Fi IRQ to CPU Core 2 (smp_affinity mask 4)
IRQ0=$(grep -m1 -i ath10k /proc/interrupts | awk '{print $1}' | tr -d ':')
IRQ1=$(grep -m2 -i ath10k /proc/interrupts | tail -n1 | awk '{print $1}' | tr -d ':')
[ -n "$IRQ0" ] && echo 2 > /proc/irq/$IRQ0/smp_affinity
[ -n "$IRQ1" ] && echo 4 > /proc/irq/$IRQ1/smp_affinity
```
This distributes processing across CPU cores, keeping `cpu0` free for routing and packet forwarding (`packet_steering = 1`).
