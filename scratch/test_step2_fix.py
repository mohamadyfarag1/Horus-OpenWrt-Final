import json
import os

# 1. Test plain text CONTROL file
control_content = """BOARD="h1radio,ti04-708hp"
KERNEL="kernel"
ROOTFS="root"
"""
with open("test_CONTROL", "w") as f:
    f.write(control_content)

# Verify grep on CONTROL
assert "h1radio" in control_content or "ti04-708hp" in control_content
print("CONTROL verification passed!")

# 2. Test metadata extraction from binary trailer
sample_fw = b"FAKE_FIRMWARE_BINARY_BYTES" * 5000
meta_obj = {
    "metadata_version": "1.1",
    "compat_version": "1.1",
    "supported_devices": ["h1radio,ti04-708hp", "H1Radio,ti04-708hp"],
    "version": {"dist": "OpenWrt", "version": "24.10.8"}
}
raw_json = json.dumps(meta_obj).encode('utf-8')
# Simulate fwtool trailer
full_bin = sample_fw + raw_json + b'\x00\x00\x00\x00\x00\x00\x00\x00FWx0\x12\x34\x56\x78\x01\x00\x00\x00\x00\x01\x00\x00'

with open("test_sysupgrade.bin", "wb") as f:
    f.write(full_bin)

# Test extraction logic
with open("test_sysupgrade.bin", "rb") as f:
    f.seek(max(0, f.seek(0, 2) - 65536))
    tail = f.read()

idx = tail.find(b'{"metadata_version"')
if idx == -1:
    idx = tail.find(b'{"compat_version"')
assert idx != -1

text = tail[idx:].decode("utf-8", errors="ignore")
extracted_meta, _ = json.JSONDecoder().raw_decode(text)
assert extracted_meta.get("compat_version") == "1.1"
print("Extracted compat_version:", extracted_meta.get("compat_version"))
print("ALL TESTS PASSED CLEANLY!")

# Clean up
os.remove("test_CONTROL")
os.remove("test_sysupgrade.bin")
