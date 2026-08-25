import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.100.2", 22, "root", "1234", timeout=10)

# Check board-2.bin for 8377
stdin, stdout, stderr = c.exec_command("hexdump -v /lib/firmware/ath10k/QCA4019/hw1.0/board-2.bin | grep 8377 | head -5")
print("0x8377 in board-2.bin:")
print(stdout.read().decode().strip())

# Check ART partition for 8377
stdin, stdout, stderr = c.exec_command("hexdump -v /dev/mtd7 | grep 8377 | head -5")
print("\n0x8377 in ART partition:")
print(stdout.read().decode().strip())

# dmesg board_file and bmi_id
stdin, stdout, stderr = c.exec_command("dmesg | grep -E 'board_file|bmi_id|regdomain|crc32'")
print("\ndmesg board/reg info:")
print(stdout.read().decode().strip())

c.close()
