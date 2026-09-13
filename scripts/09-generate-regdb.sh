#!/bin/bash
# =============================================
# Script 9: Generate Custom Unlocked Regulatory DB
# =============================================
set -e

echo "======================================="
echo "Generating Unlocked Regulatory Database"
echo "======================================="

# We are currently in the repository root (Horus-OpenWrt-Final)
if [ ! -d "wireless-regdb" ]; then
    git clone https://git.kernel.org/pub/scm/linux/kernel/git/sforshee/wireless-regdb.git || true
fi
cd wireless-regdb

# Restore the original db.txt from git just in case
git checkout db.txt || true

# Remove existing AQ, BV, TF, HM, GS if they exist to avoid conflicts
sed -i '/^country AQ:/,/^$/d' db.txt
sed -i '/^country BV:/,/^$/d' db.txt
sed -i '/^country TF:/,/^$/d' db.txt
sed -i '/^country HM:/,/^$/d' db.txt
sed -i '/^country GS:/,/^$/d' db.txt

# Append our custom SUPER countries
cat << 'DBEOF' >> db.txt

country AQ:
	(4880 - 5255 @ 160), (33)

country BV:
	(5180 - 5555 @ 160), (33)

country TF:
	(5480 - 5855 @ 160), (33)

country HM:
	(5780 - 6140 @ 160), (33)

country GS:
	(2180 - 2750 @ 40), (33)
DBEOF

openssl ecparam -name prime256v1 -genkey -noout -out key.priv.pem
make || echo "WARNING: regulatory.db build failed"

# We are in wireless-regdb, so openwrt is in the parent directory
mkdir -p ../openwrt/files/lib/firmware
cp regulatory.db ../openwrt/files/lib/firmware/regulatory.db
echo "Injected custom regulatory.db into firmware files!"



