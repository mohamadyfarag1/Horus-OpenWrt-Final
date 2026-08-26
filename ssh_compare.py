import paramiko
import time

def run_ssh(host, password, commands):
    print(f"\n=============================================")
    print(f"=== HOST: {host} ===")
    print(f"=============================================")
    try:
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(host, 22, "root", password, timeout=10)
        for cmd in commands:
            print(f"\n--- {cmd} ---")
            stdin, stdout, stderr = c.exec_command(cmd)
            out = stdout.read().decode("utf-8", errors="ignore").strip()
            err = stderr.read().decode("utf-8", errors="ignore").strip()
            if out: print(out[:1000] + ("..." if len(out)>1000 else ""))
            if err: print(f"ERR: {err}")
        c.close()
    except Exception as e:
        print(f"Failed to connect to {host}: {e}")

cmds = [
    "cat /etc/openwrt_release",
    "uname -r",
    "iw reg get",
    "iwinfo phy1 freqlist",
    "dmesg | grep -i regdomain",
    "cat /etc/config/wireless"
]

run_ssh("192.168.100.2", "1234", cmds)
run_ssh("192.168.100.1", "", cmds)
