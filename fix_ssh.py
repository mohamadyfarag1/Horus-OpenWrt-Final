import subprocess
import json

with open('fix_board.json', 'r') as f:
    content = f.read()

# We can just write it using cat and proper escaping
# But python's subprocess can feed it to stdin
proc = subprocess.Popen(['ssh', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null', 'root@192.168.100.1', 'cat > /etc/board.json && /etc/init.d/rpcd restart'], stdin=subprocess.PIPE)
proc.communicate(input=content.encode('utf-8'))
print('Done!')
