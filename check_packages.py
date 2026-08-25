import paramiko
def run():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect('192.168.100.2', 22, 'root', '1234', timeout=15)
    stdin, stdout, stderr = c.exec_command('opkg list-installed | grep ath10k')
    print("Packages:")
    print(stdout.read().decode('utf-8').strip())
    c.close()
run()
