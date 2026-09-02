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

python3 -c "
# Generate db.txt with ALL countries unlocked
countries = [
    '00',
    'AD','AE','AF','AL','AM','AN','AR','AT','AU','AW','AZ',
    'BA','BB','BD','BE','BG','BH','BL','BN','BO','BR','BY',
    'CA','CF','CH','CI','CL','CN','CO','CR','CY','CZ',
    'DE','DK','DO','DZ',
    'EC','EE','EG','ES','ET',
    'FI','FR',
    'GB','GE','GH','GL','GP','GR','GT','GU','GY',
    'HK','HN','HR','HT','HU',
    'ID','IE','IL','IN','IQ','IR','IS','IT',
    'JM','JO','JP',
    'KE','KH','KN','KP','KR','KW','KY','KZ',
    'LB','LC','LI','LK','LS','LT','LU','LV',
    'MA','MC','MD','ME','MF','MH','MK','MN','MO','MP','MQ','MR','MT','MU','MW','MX','MY',
    'NG','NI','NL','NO','NP','NZ',
    'OM',
    'PA','PE','PF','PG','PH','PK','PL','PM','PR','PT','PW','PY',
    'QA',
    'RE','RO','RS','RU','RW',
    'SA','SE','SG','SI','SK','SN','SR','SV','SY',
    'TC','TD','TG','TH','TN','TR','TT','TW','TZ',
    'UA','UG','US','UY','UZ',
    'VC','VE','VI','VN','VU',
    'WF','WS',
    'YE','YT',
    'ZA','ZW'
]
with open('db.txt', 'w') as f:
    for c in countries:
        if c == '00':
            f.write('country 00:\n')
        else:
            f.write(f'country {c}:\n')
        # Bounded to what the QCA4019 board data is actually calibrated for.
        #
        # The previous rules claimed 2182-2484 and 5115-5930 at 33 dBm. Large
        # parts of that span (below 2400, below 5170, above 5835) are not Wi-Fi
        # channels and have no calibration table in board-2.bin, so the driver
        # reported 0 dBm there and the radio would not transmit at all.
        #
        # DFS blocks are marked DFS so the kernel runs the radar check instead
        # of beaconing blindly on top of weather/aviation radar.
        f.write('\t(2402 - 2482 @ 40), (30)\n')
        f.write('\t(5170 - 5250 @ 80), (30)\n')
        f.write('\t(5250 - 5330 @ 80), (24), DFS\n')
        f.write('\t(5490 - 5730 @ 80), (24), DFS\n')
        f.write('\t(5735 - 5835 @ 80), (30)\n')
        f.write('\n')
print(f'Generated db.txt with {len(countries)} countries')
"
openssl ecparam -name prime256v1 -genkey -noout -out key.priv.pem
make || echo "WARNING: regulatory.db build failed"

# We are in wireless-regdb, so openwrt is in the parent directory
mkdir -p ../openwrt/files/lib/firmware
cp regulatory.db ../openwrt/files/lib/firmware/regulatory.db
echo "Injected custom regulatory.db into firmware files!"
