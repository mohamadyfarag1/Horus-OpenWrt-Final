import re

with open('router.dts', 'r') as f:
    content = f.read()

# Fix NAND partition label and size
def patch_nand_part(m):
    return m.group(0).replace('rootfs', 'ubi').replace('0x2000000', '0x8000000')

content = re.sub(r'partition@0\s*\{\s*label\s*=\s*"rootfs";\s*reg\s*=\s*<0x0 0x2000000>;\s*\};', patch_nand_part, content)

# Fix chosen node to have standard OpenWrt bootargs
def patch_chosen(m):
    return 'chosen {\n        bootargs-append = " ubi.mtd=ubi root=/dev/ubiblock0_1";\n    };'

content = re.sub(r'chosen\s*\{[^}]*\};', patch_chosen, content)

with open('router_patched.dts', 'w') as f:
    f.write(content)
