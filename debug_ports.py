import paramiko
import sys

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

passwords = ['1234', 'admin', 'password', 'root', '']
connected = False

for pwd in passwords:
    try:
        print(f'Trying password: "{pwd}"')
        client.connect('192.168.100.1', username='root', password=pwd, timeout=5, allow_agent=False, look_for_keys=False)
        print('Connected!')
        connected = True
        break
    except Exception as e:
        continue

if not connected:
    print('Failed to connect with all passwords.')
    sys.exit(1)

def run_cmd(cmd):
    print(f'\n--- {cmd} ---')
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    if out: print(out[:1500])
    if err: print('ERR:', err[:500])

run_cmd('ubus call luci get_ports')
run_cmd('cat /etc/board.json')
run_cmd('ls -l /sys/class/net/')
run_cmd('cat /etc/config/network')

client.close()
