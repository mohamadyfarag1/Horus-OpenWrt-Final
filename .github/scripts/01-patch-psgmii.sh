#!/bin/bash
# Patch QCA8k switch driver to completely skip the 100-retry PSGMII loop (fixes 3-minute boot delay)
echo "Applying PSGMII boot delay patch..."
for f in $(find build_dir/ -path "*/drivers/net/dsa/qca/qca8k*c" 2>/dev/null); do
    sed -i 's/retries < 100/retries < 1/g' "$f"
    sed -i 's/retries < 10 /retries < 1 /g' "$f"
    echo "Patched PSGMII boot delay loop in: $f"
done
