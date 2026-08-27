
with open('files_ap/usr/bin/enable-extroot.sh', 'r') as f:
    content = f.read()

import re
content = re.sub(r'if \[ -d \
\/lib/modules\.*?fi\nfi', 
'''if [ -d \/lib/modules\ ]; then
    if [ ! -d \/lib/modules/\ ]; then
        echo \Syncing
new
kernel
modules
to
USB...\
        mkdir -p \/lib/modules/\
        cp -a /lib/modules//* \/lib/modules//\ 2>/dev/null
    fi
fi''', content, flags=re.DOTALL)

with open('files_ap/usr/bin/enable-extroot.sh', 'w', newline='\n') as f:
    f.write(content)

