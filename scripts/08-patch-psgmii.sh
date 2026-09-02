#!/bin/bash
# =============================================
# Script 8: Verify QCA8K PSGMII calibration integrity
# =============================================
set -e

echo "============================================="
echo "=== VERIFYING QCA8K PSGMII CALIBRATION ======="
echo "============================================="

# ---------------------------------------------------------------------
# DO NOT TURN THIS BACK INTO A PATCHER.
#
# This script used to DELETE the PSGMII calibration self-test:
#   * it rewrote psgmii_vco_calibrate_and_test() down to a single,
#     unverified psgmii_vco_calibrate() call, and
#   * it changed QCA8K_PSGMII_CALB_NUM from 100 to 0.
#
# The IPQ4019 PSGMII VCO calibration randomly comes out WRONG. That is
# precisely why upstream calibrates, then runs a serial and a parallel
# port self-test, and retries until the test passes. With the self-test
# deleted a bad calibration is never detected and never retried, so the
# switch SerDes is left mis-calibrated. Observed on this hardware:
#   * LAN ports link several minutes late, or not at all;
#   * a warm reboot does not reset the analog PSGMII state, so the bad
#     calibration survives sysupgrade and only a COLD power cycle clears
#     it - matching the "I must switch the AP off and on after an
#     update" report.
#
# The slow boot this script was written to cure is a SYMPTOM of a
# failing calibration, not a cost of the retry loop. When calibration
# succeeds on the first attempt the loop exits immediately and the ports
# come up in about a second.
#
# So: verify the upstream logic is intact and change nothing.
# ---------------------------------------------------------------------

cat << 'PYEOF' > /tmp/verify_psgmii_internal.py
import os, re, sys

checked = 0
damaged = []

for root, dirs, files in os.walk('.'):
    for name in files:
        is_patch = name.endswith('.patch') and '706' in name
        is_src = name.endswith('.c') and 'qca8k' in name
        if not (is_patch or is_src):
            continue

        path = os.path.join(root, name)
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as fh:
                content = fh.read()
        except OSError:
            continue
        if 'psgmii_vco_calibrate_and_test' not in content:
            continue

        checked += 1
        problems = []

        m = re.search(r'QCA8K_PSGMII_CALB_NUM\s+(\d+)', content)
        if m and int(m.group(1)) < 10:
            problems.append('retry budget cut to %s' % m.group(1))
        if 'qca8k_do_dsa_sw_ports_self_test' not in content:
            problems.append('port self-test removed')
        if 'PSGMII work is unstable' not in content:
            problems.append('retry loop removed')

        if problems:
            damaged.append((path, problems))
        else:
            print('OK   %s' % path)

if checked == 0:
    print('NOTE: no qca8k PSGMII source visible at this build stage - nothing to verify.')
elif damaged:
    print('')
    print('!!!! PSGMII CALIBRATION VERIFICATION FAILED !!!!')
    for path, problems in damaged:
        print('  %s -> %s' % (path, ', '.join(problems)))
    print('')
    print('  Shipping this produces LAN ports that link minutes late and')
    print('  recover only after a cold power cycle. Refusing to build.')
    sys.exit(1)
else:
    print('PSGMII calibration + self-test + retry loop intact in %d file(s).' % checked)
PYEOF

python3 /tmp/verify_psgmii_internal.py
rm -f /tmp/verify_psgmii_internal.py
