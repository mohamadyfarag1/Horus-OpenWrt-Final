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
        # The range has to clear the OUTERMOST 20 MHz sub-channel of the
        # widest block we allow, not just the channel centres. cfg80211
        # (cfg80211_does_bw_fit_range) disables a channel unless
        # centre +/- 10 MHz fits inside a rule, and an 80 MHz block is only
        # accepted when every one of its four 20 MHz sub-channels passes.
        #
        # 5 GHz plan covers 4920..6100 MHz (channels 16..237):
        #   Lowest channel 4920 -> needs <= 4880 for VHT80 bonding
        #   Highest channel 6100 -> needs >= 6140 for VHT80 bonding
        # 2.4 GHz plan covers 2312..2732 MHz
        f.write('\t(2180 - 2750 @ 40), (33)\n')
        f.write('\t(4800 - 6150 @ 160), (33)\n')
        f.write('\n')
print(f'Generated db.txt with {len(countries)} countries')
"
openssl ecparam -name prime256v1 -genkey -noout -out key.priv.pem
make || echo "WARNING: regulatory.db build failed"

# We are in wireless-regdb, so openwrt is in the parent directory
mkdir -p ../openwrt/files/lib/firmware
cp regulatory.db ../openwrt/files/lib/firmware/regulatory.db
echo "Injected custom regulatory.db into firmware files!"
