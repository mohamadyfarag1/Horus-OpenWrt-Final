import paramiko
import sys

def run():
    try:
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect('192.168.100.2', 22, 'root', '1234', timeout=15)
        sftp = c.open_sftp()
        sftp.get('/lib/firmware/ath10k/QCA4019/hw1.0/board-2.bin', 'board-2.bin')
        sftp.close()
        print('board-2.bin downloaded successfully!')
    except Exception as e:
        print(f'Error: {e}')
    finally:
        c.close()

run()
