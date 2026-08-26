import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    c.connect("192.168.100.2", 22, "root", "1234", timeout=10)
    cmd = "strings /lib/modules/*/mac80211.ko /lib/modules/*/ath.ko /lib/modules/*/cfg80211.ko | grep -E '2192|2732|4900|6100'"
    stdin, stdout, stderr = c.exec_command(cmd)
    print(stdout.read().decode("utf-8").strip())
except Exception as e:
    print(e)
