
import re
content = '''
                    partition@0 {
                        label = \
rootfs\;
                        reg = <0x0 0x2000000>;
                    };
'''
def patch_rootfs(match):
    block = match.group(0)
    block = re.sub(r'0x0*2000000', '0x08000000', block)
    return block
res = re.sub(r'(partition@[0-9a-fA-F]+\s*\{[^}]*label\s*=\s*\rootfs\;[^}]*\})', patch_rootfs, content, flags=re.DOTALL)
print(res)

