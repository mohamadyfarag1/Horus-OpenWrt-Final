#!/bin/bash
# =============================================
# Script 1: Setup Device Tree for Horus 9200
# =============================================
set -e

cd openwrt

dts_path_66="target/linux/ipq40xx/files-6.6/arch/arm/boot/dts/qcom/qcom-ipq4019-h1radio-ti04-708hp.dts"
dts_path_base="target/linux/ipq40xx/files/arch/arm/boot/dts/qcom/qcom-ipq4019-h1radio-ti04-708hp.dts"
mkdir -p $(dirname "$dts_path_66")
mkdir -p $(dirname "$dts_path_base")

echo "Decompiling original factory router.dtb to preserve perfect LAN/WAN/Switch config..."
dtc -I dtb -O dts -o "$dts_path_66" ../router.dtb || true

if [ ! -f "$dts_path_66" ]; then
    sudo apt-get install -y device-tree-compiler
    dtc -I dtb -O dts -o "$dts_path_66" ../router.dtb
fi

echo "Patching 128MB SPI NAND capacity and model strings into factory DTS..."
python3 -c '
import re, sys
with open(sys.argv[1], "r") as f:
    dts = f.read()

# Replace model and compatible in the root node
dts = re.sub(r"model\s*=\s*\"[^\"]+\";", "model = \"Horus 9200\";", dts, count=1)
dts = re.sub(r"compatible\s*=\s*\"[^\"]+\"(.*?);", "compatible = \"h1radio,ti04-708hp\", \"qcom,ipq4019\";", dts, count=1)

# Find rootfs or ubi partition and force size to 128MB (0x8000000)
# We match label = "rootfs" and the following reg = <offset size>
dts = re.sub(r"(label\s*=\s*\"rootfs\";\s*reg\s*=\s*<0x[0-9a-fA-F]+\s+)(0x[0-9a-fA-F]+)(>;)", r"\g<1>0x8000000\g<3>", dts)
dts = re.sub(r"(label\s*=\s*\"ubi\";\s*reg\s*=\s*<0x[0-9a-fA-F]+\s+)(0x[0-9a-fA-F]+)(>;)", r"\g<1>0x8000000\g<3>", dts)
# Switch PHY reset timings to prevent cold boot switch reset loop:
# Increase reset-delay-us from 5ms (0x1388) to 30ms (0x7530) and add reset-post-delay-us (30ms)
dts = re.sub(
    r"reset-delay-us\s*=\s*<0x[0-9a-fA-F]+>;",
    "reset-delay-us = <0x7530>;\n\t\t\treset-post-delay-us = <0x7530>;",
    dts
)

# Debounce reset and wps buttons to prevent cold boot floating pin failsafe trigger
dts = re.sub(
    r"(label\s*=\s*\"reset\";\s*gpios\s*=\s*<0x[0-9a-fA-F]+\s+0x3F\s+0x1>;\s*linux,code\s*=\s*<0x198>;)",
    r"\g<1>\n\t\t\tdebounce-interval = <100>;",
    dts
)
dts = re.sub(
    r"(label\s*=\s*\"wps\";\s*gpios\s*=\s*<0x[0-9a-fA-F]+\s+0x2\s+0x1>;\s*linux,code\s*=\s*<0x211>;)",
    r"\g<1>\n\t\t\tdebounce-interval = <100>;",
    dts
)

with open(sys.argv[1], "w") as f:
    f.write(dts)
' "$dts_path_66"

cp "$dts_path_66" "$dts_path_base"

echo "✅ DTS setup complete."
