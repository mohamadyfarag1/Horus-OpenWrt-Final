import paramiko
import sys
import json

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print('Connecting...')
    client.connect('192.168.100.1', username='root', password='', timeout=5, allow_agent=False, look_for_keys=False)
    
    print('\n--- UBUS DEVICE STATUS ---')
    stdin, stdout, stderr = client.exec_command('ubus call network.device status')
    print(stdout.read().decode('utf-8')[:1000])

    print('\n--- BOARD.JSON ---')
    stdin, stdout, stderr = client.exec_command('cat /etc/board.json')
    print(stdout.read().decode('utf-8'))

    print('\n--- KERNEL DEVICES ---')
    stdin, stdout, stderr = client.exec_command('ls -l /sys/class/net/')
    print(stdout.read().decode('utf-8'))
    
    client.close()
except Exception as e:
    print(f'Error: {e}')
