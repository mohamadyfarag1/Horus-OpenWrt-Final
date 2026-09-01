#!/bin/bash
# =============================================
# Script 8: Fix QCA8K PSGMII Boot Delay / Hang
# =============================================
set -e

echo "============================================="
echo "=== PATCHING QCA8K PSGMII CALIBRATION LOOP ==="
echo "============================================="

cat << 'PYEOF' > /tmp/patch_psgmii_internal.py
import os, sys, re

count_patches = 0
# 1. Patch OpenWrt patch files (e.g. 706-*.patch)
for root, dirs, files in os.walk('.'):
    for file in files:
        if '706' in file and file.endswith('.patch'):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                if 'PSGMII work is unstable' in content or 'psgmii_vco_calibrate_and_test' in content:
                    print("Patching OpenWrt patch file:", path)
                    # Replace QCA8K_PSGMII_CALB_NUM 100 with 0
                    content = re.sub(r'#define\s+QCA8K_PSGMII_CALB_NUM\s+100', '#define   QCA8K_PSGMII_CALB_NUM\t\t\t\t0', content)
                    # Replace psgmii_vco_calibrate_and_test implementation in patch
                    patch_pattern = r'\+static\s+int\n\+psgmii_vco_calibrate_and_test\s*\(\s*struct\s+dsa_switch\s*\*\s*ds\s*\)\n\+\{.*?\n\+\}'
                    patch_replacement = '''+static int
+psgmii_vco_calibrate_and_test(struct dsa_switch *ds)
+{
+	struct qca8k_priv *priv = ds->priv;
+	return psgmii_vco_calibrate(priv);
+}'''
                    content = re.sub(patch_pattern, patch_replacement, content, flags=re.DOTALL)
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print("  -> Successfully patched patch file:", path)
                    count_patches += 1
            except Exception as e:
                print("Error patching patch file:", e)

# 2. Patch C source files
for root, dirs, files in os.walk('.'):
    for file in files:
        if file.endswith('.c'):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                if 'PSGMII work is unstable' in content or 'psgmii_vco_calibrate_and_test' in content:
                    print("Patching C source file:", path)
                    # Replace QCA8K_PSGMII_CALB_NUM 100 with 0
                    content = re.sub(r'#define\s+QCA8K_PSGMII_CALB_NUM\s+100', '#define   QCA8K_PSGMII_CALB_NUM\t\t\t\t0', content)
                    # Replace psgmii_vco_calibrate_and_test implementation
                    c_pattern = r'static\s+int\s+psgmii_vco_calibrate_and_test\s*\(\s*struct\s+dsa_switch\s*\*\s*ds\s*\)\s*\{.*?\n\}'
                    c_replacement = '''static int
psgmii_vco_calibrate_and_test(struct dsa_switch *ds)
{
	struct qca8k_priv *priv = ds->priv;
	return psgmii_vco_calibrate(priv);
}'''
                    content = re.sub(c_pattern, c_replacement, content, flags=re.DOTALL)
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print("  -> Successfully patched C source file:", path)
                    count_patches += 1
            except Exception as e:
                print("Error patching C file:", e)

print(f"PSGMII patching completed: {count_patches} file(s) modified.")
PYEOF

python3 /tmp/patch_psgmii_internal.py
rm -f /tmp/patch_psgmii_internal.py
