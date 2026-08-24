#!/bin/bash
# Modify DTS for Horus 9200
echo "Applying DTS modifications for Horus 9200..."
dts_path_66="target/linux/ipq40xx/files-6.6/arch/arm/boot/dts/qcom/qcom-ipq4019-h1radio-ti04-708hp.dts"
dts_path_base="target/linux/ipq40xx/files/arch/arm/boot/dts/qcom/qcom-ipq4019-h1radio-ti04-708hp.dts"

mkdir -p $(dirname "$dts_path_66")
mkdir -p $(dirname "$dts_path_base")

# Generate custom DTS based on Jalapeno (internal switch), but with 128MB SPI NAND and Pin 42 PSGMII reset
cat << 'EOF' > "$dts_path_66"
// SPDX-License-Identifier: GPL-2.0-or-later OR MIT
#include "qcom-ipq4018-jalapeno.dtsi"

/ {
    model = "Horus 9200";
    compatible = "h1radio,ti04-708hp", "8dev,jalapeno", "qcom,ipq4019";
};

&mdio {
    /* H1Radio (NBG6617 clone) uses Pin 42 for switch reset, not Jalapeno's Pin 58 */
    reset-gpios = <&tlmm 42 GPIO_ACTIVE_LOW>;
};

&nand {
    status = "okay";
    nand@0 {
        partitions {
            compatible = "fixed-partitions";
            #address-cells = <1>;
            #size-cells = <1>;
            partition@0 {
                label = "ubi";
                reg = <0x0 0x8000000>;
            };
        };
    };
};
&spi_1 {
    status = "okay";
    flash@1 {
        compatible = "spi-nand";
        reg = <1>;
        spi-max-frequency = <24000000>;
        partitions {
            compatible = "fixed-partitions";
            #address-cells = <1>;
            #size-cells = <1>;
            partition@0 {
                label = "ubi";
                reg = <0x0 0x8000000>;
            };
        };
    };
};
EOF

# Fix chosen bootargs
sed -i 's/bootargs = .*/bootargs = "cma=32M mtdparts=spi0.1:128m(ubi) ubi.mtd=ubi root=\/dev\/ubiblock0_1 rootfstype=squashfs";/g' "$dts_path_66"

# Apply SPI NAND node fix
sed -i 's/spi_0/spi_1/g' "$dts_path_66"
sed -i 's/flash@0/flash@1/g' "$dts_path_66"

cp "$dts_path_66" "$dts_path_base"

echo "DTS generation complete."
