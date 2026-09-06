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

# Wrap ethernet-phy@0..4 in ethernet-phy-package@0 for Linux 6.6 qca807x driver compatibility.
# Without ethernet-phy-package@0, devm_of_phy_package_join() fails with -EINVAL (-22),
# which forces fallback to Generic PHY (irq=POLL), disabling hardware link interrupts,
# DAC tuning (qcom,control-dac=<5>), and analog calibration, causing delayed/broken LAN link.
mdio_pattern = r"(mdio@90000\s*\{.*?)(\s*ethernet-phy@0\s*\{.*?\s*ethernet-phy@4\s*\{[^}]*?\};)(\s*psgmii-phy@5)"
match = re.search(mdio_pattern, dts, re.DOTALL)
if match:
    phys_content = match.group(2).strip()
    indented_phys = ""
    for line in phys_content.splitlines():
        s = line.strip()
        if not s:
            continue
        if s.startswith("ethernet-phy@") or s == "};":
            indented_phys += "                " + s + "\n"
        else:
            indented_phys += "                    " + s + "\n"

    package_block = (
        "\n            ethernet-phy-package@0 {\n"
        "                #address-cells = <1>;\n"
        "                #size-cells = <0>;\n"
        "                compatible = \"qcom,qca8075-package\";\n"
        "                reg = <0>;\n"
        "                qcom,tx-drive-strength-milliwatt = <300>;\n\n"
        f"{indented_phys}"
        "            };\n"
    )
    dts = dts[:match.start(2)] + package_block + dts[match.end(2):]
    print("Wrapped QCA8075 PHYs in ethernet-phy-package@0 for Linux 6.6.")
else:
    print("WARNING: mdio@90000 ethernet-phy pattern did not match!")

with open(sys.argv[1], "w") as f:
    f.write(dts)
' "$dts_path_66"

cp "$dts_path_66" "$dts_path_base"

echo "✅ DTS setup complete."
