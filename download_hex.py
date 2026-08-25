import paramiko
import binascii

def run():
    try:
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect('192.168.100.2', 22, 'root', '1234', timeout=15)
        stdin, stdout, stderr = c.exec_command('hexdump -v -e \"/1 \\"%02x\\"\" /lib/firmware/ath10k/QCA4019/hw1.0/board-2.bin')
        hex_data = stdout.read().decode('ascii').strip()
        with open('board-2.bin', 'wb') as f:
            f.write(binascii.unhexlify(hex_data))
        print('board-2.bin downloaded and decoded via hex successfully!')
    except Exception as e:
        print(f'Error: {e}')
    finally:
        c.close()

run()
