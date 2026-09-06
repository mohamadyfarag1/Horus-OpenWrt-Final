import hashlib

with open("board-2.bin", "rb") as f:
    data = f.read()
print(f"board-2.bin: {len(data)} bytes, MD5: {hashlib.md5(data).hexdigest()}")

with open("files_ap/lib/firmware/regulatory.db", "rb") as f:
    local_reg = f.read()
golden_md5 = "5a5efbf28f3582a0cfc62472a3b33a5d"
local_md5 = hashlib.md5(local_reg).hexdigest()
print(f"local regulatory.db MD5:  {local_md5}")
print(f"golden regulatory.db MD5: {golden_md5}")
print(f"Match: {local_md5 == golden_md5}")

# Search for 0x8377 in board-2.bin (little endian = 77 83)
print("\nSearching for 0x8377 bytes in board-2.bin:")
idx = 0
count = 0
while count < 5:
    idx = data.find(b"\x77\x83", idx)
    if idx == -1:
        break
    ctx = data[max(0, idx-4):idx+8].hex()
    print(f"  Found at byte {idx} (0x{idx:06x}): {ctx}")
    idx += 2
    count += 1
if count == 0:
    print("  NOT FOUND - 0x8377 is NOT in board-2.bin!")

# Check the board-2.bin at offset 0x83770
print(f"\nboard-2.bin at offset 0x83770: {data[0x83770:0x83780].hex()}")
