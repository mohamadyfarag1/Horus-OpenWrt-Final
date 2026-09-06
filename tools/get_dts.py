import paramiko
import binascii

def run():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect('192.168.100.2', 22, 'root', '1234', timeout=15)
    
    # We can read the live device tree from /sys/firmware/fdt
    stdin, stdout, stderr = c.exec_command('hexdump -v -e "/1 \\"%02x\\"" /sys/firmware/fdt')
    hex_data = stdout.read().decode('ascii').strip()
    with open('golden.dtb', 'wb') as f:
        f.write(binascii.unhexlify(hex_data))
    print("Golden DTB downloaded.")
    c.close()

run()
