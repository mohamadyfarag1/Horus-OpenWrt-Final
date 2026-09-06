import os

with open('art_2.bin', 'rb') as f:
    data = f.read()

print(f"File size: {len(data)} bytes")
# Check for common QCA magic bytes or structures
# QCA4019 caldata often starts with a specific signature or has MACs at specific offsets
# Let's search for readable strings
def get_strings(b, min_len=4):
    res = []
    curr = ""
    for byte in b:
        if 32 <= byte <= 126:
            curr += chr(byte)
        else:
            if len(curr) >= min_len:
                res.append(curr)
            curr = ""
    return res

print("Found Strings in ART (First 20):")
print(get_strings(data)[:20])
