#!/bin/bash
# =============================================
# Script 3: Patch platform.sh for sysupgrade
# =============================================
set -e

cd openwrt

# Completely disable board mismatch checks (Accept ANY firmware)
echo "platform_check_image() { return 0; }" >> target/linux/ipq40xx/base-files/lib/upgrade/platform.sh
# We also patch fwtool to bypass metadata checks
sed -i 's/fwtool -q/fwtool -q -i/g' package/base-files/files/sbin/sysupgrade 2>/dev/null || true

# CRITICAL: Add nand_do_upgrade for this device so sysupgrade writes UBI volumes correctly
printf '\nplatform_do_upgrade() {\n\tlocal board\n\tboard=$(board_name)\n\tcase "$board" in\n\th1radio,ti04-708hp|H1Radio,ti04-708hp)\n\t\tnand_do_upgrade "$1"\n\t\t;;\n\t*)\n\t\tdefault_do_upgrade "$1"\n\t\t;;\n\tesac\n}\n' >> target/linux/ipq40xx/base-files/lib/upgrade/platform.sh

echo "✅ platform.sh patched for sysupgrade support."
