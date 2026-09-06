import paramiko
import sys

def run():
    with open('ssh_out.txt', 'w', encoding='utf-8') as f:
        def log(msg):
            print(msg)
            f.write(msg + '\n')
            f.flush()
        try:
            c = paramiko.SSHClient()
            c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            log('Connecting to 192.168.100.2...')
            c.connect('192.168.100.2', 22, 'root', '1234', timeout=15)
            log('Connected!')
            cmds = [
                'cat /etc/openwrt_release',
                'iw reg get',
                'iwinfo',
                'cat /etc/config/wireless',
                'md5sum /lib/firmware/ath10k/QCA4019/hw1.0/board-2.bin',
                'dmesg | grep ath10k'
            ]
            for cmd in cmds:
                log(f'\n=== {cmd} ===')
                stdin, stdout, stderr = c.exec_command(cmd)
                out = stdout.read().decode('utf-8', errors='replace').strip()
                log(out)
        except Exception as e:
            log(f'Error: {e}')
        finally:
            c.close()

run()
