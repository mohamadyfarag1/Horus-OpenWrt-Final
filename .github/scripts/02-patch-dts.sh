#!/bin/bash
# Modify DTS for Horus 9200
echo "Applying DTS modifications for Horus 9200..."
dts_path_66="target/linux/ipq40xx/files-6.6/arch/arm/boot/dts/qcom/qcom-ipq4019-h1radio-ti04-708hp.dts"
dts_path_base="target/linux/ipq40xx/files/arch/arm/boot/dts/qcom/qcom-ipq4019-h1radio-ti04-708hp.dts"

mkdir -p $(dirname "$dts_path_66")
mkdir -p $(dirname "$dts_path_base")

echo "Decompiling original factory router.dtb to preserve perfect LAN/WAN/Switch config..."
# Decompile the original working router.dtb
dtc -I dtb -O dts -o "$dts_path_66" ../router.dtb

# Patch the DTS safely to upgrade NAND rootfs partition to 128MB and fix UBI mounting
# 1. Forcefully patch partition label and size
sed -i 's/label = "rootfs";/label = "ubi";/g' "$dts_path_66"
sed -i 's/reg = <0x0 0x2000000>;/reg = <0x0 0x8000000>;/g' "$dts_path_66"

# 2. Fix chosen bootargs
sed -i 's/bootargs = .*/bootargs = "cma=32M mtdparts=spi0.1:128m(ubi) ubi.mtd=ubi root=\/dev\/ubiblock0_1 rootfstype=squashfs";/g' "$dts_path_66"

# 3. Update model name (NO compatible change, to preserve U-boot fixup)
sed -i 's/model = .*/model = "Horus 9200";/g' "$dts_path_66"

cp "$dts_path_66" "$dts_path_base"

echo "DTS generation complete."
