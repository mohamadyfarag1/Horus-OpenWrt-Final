import paramiko
import binascii

def ssh_run(host, user, pwd, cmd):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, user, pwd, timeout=10)
    stdin, stdout, stderr = c.exec_command(cmd)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    c.close()
    return out

print("=" * 60)
print("GOLDEN AP (192.168.100.2) - THE REFERENCE")
print("=" * 60)

print("\n[1] Kernel Version:")
print(ssh_run("192.168.100.2", "root", "1234", "uname -r"))

print("\n[2] OpenWrt Version:")
print(ssh_run("192.168.100.2", "root", "1234", "cat /etc/openwrt_release | grep DESCRIPTION"))

print("\n[3] Regulatory Domain (iw reg get):")
print(ssh_run("192.168.100.2", "root", "1234", "iw reg get"))

print("\n[4] Installed ath10k packages:")
print(ssh_run("192.168.100.2", "root", "1234", "opkg list-installed | grep -E 'ath10k|mac80211|wireless-regdb'"))

print("\n[5] board-2.bin MD5:")
print(ssh_run("192.168.100.2", "root", "1234", "md5sum /lib/firmware/ath10k/QCA4019/hw1.0/board-2.bin"))

print("\n[6] regulatory.db MD5 and size:")
print(ssh_run("192.168.100.2", "root", "1234", "md5sum /lib/firmware/regulatory.db; ls -la /lib/firmware/regulatory.db"))

print("\n[7] Max 5GHz channel (freqlist):")
print(ssh_run("192.168.100.2", "root", "1234", "iwinfo phy1 freqlist | tail -10"))

print("\n[8] Txpower on 5G radio:")
print(ssh_run("192.168.100.2", "root", "1234", "iwinfo phy1-ap0 info | grep -i power"))

print("\n[9] Kernel regulatory flags:")
print(ssh_run("192.168.100.2", "root", "1234", "cat /sys/kernel/debug/ieee80211/phy1/hwflags 2>/dev/null || echo N/A"))

print("\n[10] ATH10K regulatory override:")
print(ssh_run("192.168.100.2", "root", "1234", "cat /sys/module/ath/parameters/ath_is_world_regd 2>/dev/null; cat /sys/module/ath/parameters/ath_regd_on 2>/dev/null; ls /sys/module/ath/parameters/ 2>/dev/null"))

print("\n[11] dmesg regd info:")
print(ssh_run("192.168.100.2", "root", "1234", "dmesg | grep -i 'regd\\|regulatory\\|cfg80211' | head -20"))

print("\n[12] Wireless UCI config:")
print(ssh_run("192.168.100.2", "root", "1234", "cat /etc/config/wireless"))
