import paramiko
import binascii

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.100.2", 22, "root", "1234", timeout=10)

# Download regulatory.db via hexdump
stdin, stdout, stderr = c.exec_command('hexdump -v -e "/1 \"%02x\"" /lib/firmware/regulatory.db')
hex_data = stdout.read().decode("ascii").strip()
c.close()

data = binascii.unhexlify(hex_data)
print(f"regulatory.db size: {len(data)} bytes")
print(f"regulatory.db MD5: {__import__('hashlib').md5(data).hexdigest()}")

# Compare with our local file
with open("files_ap/lib/firmware/regulatory.db", "rb") as f:
    local_data = f.read()
print(f"\nlocal regulatory.db size: {len(local_data)} bytes")
print(f"local regulatory.db MD5:  {__import__('hashlib').md5(local_data).hexdigest()}")

if data == local_data:
    print("\n✅ Files MATCH - same content")
else:
    print("\n❌ Files DIFFER - saving golden copy")
    with open("regulatory_golden.db", "wb") as f:
        f.write(data)
    print("Saved as regulatory_golden.db")
