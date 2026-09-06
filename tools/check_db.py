import paramiko
import binascii

def run():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect('192.168.100.2', 22, 'root', '1234', timeout=15)
    
    # Check if regulatory.db exists
    stdin, stdout, stderr = c.exec_command('ls -l /lib/firmware/regulatory.db')
    out = stdout.read().decode('utf-8').strip()
    print("LS output:", out)
    
    if "No such file" not in out and out != "":
        # Download regulatory.db
        stdin, stdout, stderr = c.exec_command('hexdump -v -e \"/1 \\"%02x\\"\" /lib/firmware/regulatory.db')
        hex_data = stdout.read().decode('ascii').strip()
        if hex_data:
            with open('files_ap/lib/firmware/regulatory.db', 'wb') as f:
                f.write(binascii.unhexlify(hex_data))
            print("regulatory.db downloaded successfully!")
    c.close()

run()
