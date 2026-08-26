# 🏗️ Hardware Architecture, Device Tree (DTS/DTB), & NAND Flash Partitioning

## 1. Hardware Architecture Overview
The **Horus 9200 (H1Radio TI04-708HP)** is based on the Qualcomm Atheros IPQ4019 reference platform:
- **Processor**: Quad-core ARM Cortex-A7 @ 716 MHz (NEON VFPv4, ARMv7 32-bit).
- **RAM**: 256 MiB DDR3.
- **Dual-Flash Subsystem**:
  1. **SPI NOR (spi0.0)**: 2 MiB (GigaDevice GD25Q16) -> Holds Bootloader (SBL1, MIBIB, QSEE, CDT, DDRPARAMS, APPSBL/U-Boot, ART calibration partition).
  2. **SPI NAND (spi0.1)**: 128 MiB (Macronix MX35LFxGE4AB, 2KB page size, 128KB block size, 64-byte OOB) -> Holds UBI volume, SquashFS rootfs, and UBIFS `rootfs_data`.
- **Switch & Ethernet**: Integrated QCA8k switch (5 Gigabit Ethernet ports: 1 WAN + 4 LAN) via PSGMII interface.
- **Expansion**: USB 3.0 (xHCI Host 0) + USB 2.0 (xHCI Host 1) ports.

---

## 2. Flash Layout & Memory Map

```
+-------------------------------------------------------------------------+
| SPI NOR Flash (2 MiB) - /dev/mtd0 - /dev/mtd7                           |
+----------+----------+----------+----------+----------+----------+-------+
| SBL1     | MIBIB    | QSEE     | CDT      | DDRPARAMS| APPSBL   | ART   |
| (256KB)  | (128KB)  | (384KB)  | (64KB)   | (64KB)   | (512KB)  | (64KB)|
+----------+----------+----------+----------+----------+----------+-------+

+-------------------------------------------------------------------------+
| SPI NAND Flash (128 MiB) - /dev/mtd8 (ubi)                              |
+-------------------------------------------------------------------------+
| UBI Container (128 MiB / 1024 PEBs @ 128KB)                             |
|  ├─ Volume 0: kernel (FIT Image containing Kernel + DTB blob)           |
|  ├─ Volume 1: rootfs (SquashFS read-only root system)                   |
|  └─ Volume 2: rootfs_data (UBIFS read-write overlay filesystem)          |
+-------------------------------------------------------------------------+
```

---

## 3. Device Tree (DTS) Decompilation & Custom Patching
The factory device contains switch, GPIO, and board-specific timing in `router.dtb`. Rather than creating a generic DTS from scratch, the optimal methodology is:
1. Decompile `router.dtb` using `dtc -I dtb -O dts -o router.dts`.
2. Apply Python regular expression transformations:
   ```python
   import re, sys

   with open(sys.argv[1], "r") as f:
       dts = f.read()

   # Set official model identifier
   dts = re.sub(
       r"model\s*=\s*\"[^\"]+\";", 'model = "Horus 9200";', dts, count=1
   )

   # Set dual compatible node matching U-Boot and OpenWrt driver tables
   dts = re.sub(
       r"compatible\s*=\s*\"[^\"]+\"(.*?);",
       'compatible = "h1radio,ti04-708hp", "qcom,ipq4019";',
       dts,
       count=1,
   )

   # Expand NAND flash UBI partition to full 128MB (0x8000000)
   dts = re.sub(
       r'(label\s*=\s*"rootfs";\s*reg\s*=\s*<0x[0-9a-fA-F]+\s+)(0x[0-9a-fA-F]+)(>;)',
       r"\g<1>0x8000000\g<3>",
       dts,
   )
   dts = re.sub(
       r'(label\s*=\s*"ubi";\s*reg\s*=\s*<0x[0-9a-fA-F]+\s+)(0x[0-9a-fA-F]+)(>;)',
       r"\g<1>0x8000000\g<3>",
       dts,
   )

   with open(sys.argv[1], "w") as f:
       f.write(dts)
```

---

## 4. Sysupgrade & Board Identification (`platform.sh`)
To allow upgrading the router directly via the LuCI web interface (`sysupgrade.bin`), OpenWrt's board detection must identify `H1Radio,ti04-708hp`:
- **`target/linux/ipq40xx/base-files/lib/upgrade/platform.sh`**:
  ```bash
  nand_do_upgrade() {
      case "$board" in
      H1Radio,ti04-708hp |\
      wallys,dr40x9)
          nand_do_upgrade_ubi "$1"
          ;;
  ```
- **`target/linux/ipq40xx/base-files/etc/board.d/02_network`**:
  ```bash
  h1radio,ti04-708hp |\
  zyxel,nbg6617)
      ucidef_set_interfaces_lan_wan "lan1 lan2 lan3 lan4" "wan"
      ;;
  ```
