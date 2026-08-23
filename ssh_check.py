import paramiko
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    print("Connecting...")
    client.connect('192.168.100.2', username='root', password='1234', timeout=10)
    print("Connected! Running commands...")
    stdin, stdout, stderr = client.exec_command('uname -a ; cat /etc/openwrt_release ; ls -l /lib/firmware/ath10k/QCA4019/hw1.0/')
    print('--- STDOUT 1 ---')
    print(stdout.read().decode())
    
    stdin, stdout, stderr = client.exec_command('cat /etc/config/network ; echo ; cat /etc/config/wireless')
    print('--- CONFIGS ---')
    print(stdout.read().decode())
    
    client.close()
    print("Done")
except Exception as e:
    print('Error:', e)
