# 🧠 Horus OpenWrt Engineering Skills & Technical Knowledge Base

Welcome to the **Horus-OpenWrt-Final Skills Repository**. This knowledge base consolidates in-depth embedded Linux, Qualcomm Atheros IPQ40xx, and OpenWrt 24.10 engineering expertise gained from real-world hardware reverse-engineering, kernel-level development, and wireless optimization.

---

## 📚 Technical Modules Index

| Document | Topic | Key Technologies Covered |
| :--- | :--- | :--- |
| [01. Superchannel Architecture](01-superchannel-architecture.md) | Full Spectrum Frequency Unlocking | `ath10k-ct`, `firmware-5.bin`, `regulatory.db`, `mac80211`, `hostapd`, 10MHz Channel Spacing, 4900–6100MHz |
| [02. Hardware DTS & NAND Flash](02-hardware-dts-and-nand.md) | Device Tree & Dual-Flash Subsystem | Device Tree (`qcom-ipq4019.dts`), SPI NOR (2MB), SPI NAND (128MB), UBI/UBIFS, `platform.sh` Sysupgrade |
| [03. DSA Switch & Networking](03-switch-dsa-and-networking.md) | Distributed Switch Architecture | `qca8k-ipq4019`, PSGMII VCO Calibration, Consecutive MAC Calculation, SMP IRQ Affinity |
| [04. Storage, Ubuntu & Containers](04-usb-extroot-containers-ubuntu.md) | Extroot & Containerization | USB 3.0 Extroot, ZRAM Swap, Native Ubuntu 22.04 LTS Chroot (`armhf`), Docker & `luci-app-dockerman` |
| [05. Cloud Tunneling & Security](05-cloud-tunneling-and-security.md) | Remote Management & Monitoring | Cloudflare Zero-Trust Tunnels, Subdomain Reverse Proxy, Ingress Routing, Passive ARP/DHCP Sniffer |

---

## 🛠️ Architecture Quick Reference
- **SoC**: Qualcomm Atheros IPQ4019 (4x ARM Cortex-A7 @ 716MHz).
- **RAM**: 256 MiB DDR3 + 120 MiB compressed `zram-swap`.
- **Radios**: Dual-band concurrent (2.4GHz 2x2 802.11b/g/n + 5.0GHz 2x2 802.11a/n/ac Wave 2).
- **Target OS**: OpenWrt 24.10.8 (Linux Kernel 6.6.x + backported mac80211 from Linux 6.12).
- **Target Profile**: `h1radio_ti04-708hp` (Horus 9200).
