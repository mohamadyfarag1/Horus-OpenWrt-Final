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
dts = re.sub(r"(label\s*=\s*\"rootfs\";\s*reg\s*=\s*<0x[0-9a-fA-F]+\s+)(0x[0-9a-fA-F]+)(>;)", r"\g<1>0x8000000\g<3>", dts)
dts = re.sub(r"(label\s*=\s*\"ubi\";\s*reg\s*=\s*<0x[0-9a-fA-F]+\s+)(0x[0-9a-fA-F]+)(>;)", r"\g<1>0x8000000\g<3>", dts)

# Switch PHY reset timings to prevent cold boot switch reset loop:
# Match any format (hex or decimal)
dts = re.sub(
    r"reset-delay-us\s*=\s*<[^>]+>;",
    "reset-delay-us = <0x7530>;\n\t\t\treset-post-delay-us = <0x7530>;",
    dts
)

# Debounce reset and wps buttons to prevent cold boot floating pin failsafe trigger
dts = re.sub(
    r"(label\s*=\s*\"reset\";\s*gpios\s*=\s*<[^>]+>;\s*linux,code\s*=\s*<0x198>;)",
    r"\g<1>\n\t\t\tdebounce-interval = <100>;",
    dts
)
dts = re.sub(
    r"(label\s*=\s*\"wps\";\s*gpios\s*=\s*<[^>]+>;\s*linux,code\s*=\s*<0x211>;)",
    r"\g<1>\n\t\t\tdebounce-interval = <100>;",
    dts
)

# Wrap ethernet-phy@0..4 in ethernet-phy-package@0 for Linux 6.6 qca807x driver compatibility.
# We will do this safely using string index splitting instead of fragile regex
idx1 = dts.find("ethernet-phy@0 {")
idx2 = dts.find("psgmii-phy@5 {")

if idx1 != -1 and idx2 != -1 and idx1 < idx2:
    # Double check we are not already wrapped!
    if "ethernet-phy-package@0 {" not in dts:
        before = dts[:idx1]
        phys_content = dts[idx1:idx2]
        after = dts[idx2:]
        
        indented_phys = ""
        for line in phys_content.splitlines():
            if not line.strip():
                continue
            indented_phys += "    " + line + "\n"

        package_block = (
            "ethernet-phy-package@0 {\n"
            "                #address-cells = <1>;\n"
            "                #size-cells = <0>;\n"
            "                compatible = \"qcom,qca8075-package\";\n"
            "                reg = <0>;\n"
            "                qcom,tx-drive-strength-milliwatt = <300>;\n\n"
            f"{indented_phys}"
            "            };\n\n            "
        )
        dts = before + package_block + after
        print("Wrapped QCA8075 PHYs in ethernet-phy-package@0 for Linux 6.6.")
    else:
        print("Already wrapped in ethernet-phy-package@0.")
else:
    print("WARNING: ethernet-phy@0 or psgmii-phy@5 not found! PHY wrapper failed.")

with open(sys.argv[1], "w") as f:
    f.write(dts)
' "$dts_path_66"

cp "$dts_path_66" "$dts_path_base"

echo "✅ DTS setup complete."
