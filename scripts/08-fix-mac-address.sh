#!/bin/bash
mkdir -p files_ap/etc/uci-defaults
cat << 'INIT_EOF' > files_ap/etc/uci-defaults/99-fix-mac-address
#!/bin/sh
BASE_MAC=\
if [ -n \
