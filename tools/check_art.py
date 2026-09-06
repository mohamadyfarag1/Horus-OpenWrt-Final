import paramiko
import binascii
import sys

def get_art(host, user, pwd, out_file):
    print(f"Connecting to {host}...")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        c.connect(host, 22, user, pwd, timeout=15)
        # Find ART partition
        stdin, stdout, stderr = c.exec_command('cat /proc/mtd')
        mtd_out = stdout.read().decode('utf-8')
        art_mtd = None
        for line in mtd_out.split('\n'):
            if 'art' in line.lower() or 'caldata' in line.lower() or '0:ART' in line:
                art_mtd = line.split(':')[0]
                break
        
        if not art_mtd:
            print(f"Could not find ART partition on {host}!\nMTD:\n{mtd_out}")
            return

        print(f"Found ART on {host} at /dev/{art_mtd}. Downloading...")
        stdin, stdout, stderr = c.exec_command(f'hexdump -v -e "/1 \\"%02x\\"" /dev/{art_mtd} | head -c 262144') # limit 128KB hex
        hex_data = stdout.read().decode('ascii').strip()
        with open(out_file, 'wb') as f:
            f.write(binascii.unhexlify(hex_data))
        print(f"Saved to {out_file} (Size: {len(hex_data)//2} bytes)")
    except Exception as e:
        print(f"Error on {host}: {e}")
    finally:
        c.close()

get_art('192.168.100.2', 'root', '1234', 'art_2.bin')
get_art('192.168.100.1', 'root', '', 'art_1.bin')
