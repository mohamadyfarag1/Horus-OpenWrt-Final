import paramiko
import base64

def run():
    try:
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect('192.168.100.2', 22, 'root', '1234', timeout=15)
        stdin, stdout, stderr = c.exec_command('base64 /lib/firmware/ath10k/QCA4019/hw1.0/board-2.bin')
        b64_data = stdout.read()
        with open('board-2.bin', 'wb') as f:
            f.write(base64.b64decode(b64_data))
        print('board-2.bin downloaded and decoded successfully!')
    except Exception as e:
        print(f'Error: {e}')
    finally:
        c.close()

run()
