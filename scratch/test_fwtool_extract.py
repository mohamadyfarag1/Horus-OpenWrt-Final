import json

sample_fw = b"FAKE_FIRMWARE_DATA_HERE" * 1000
sample_meta = {
    "metadata_version": "1.1",
    "compat_version": "1.1",
    "supported_devices": ["h1radio,ti04-708hp", "H1Radio,ti04-708hp"],
    "version": {"dist": "OpenWrt", "version": "24.10.8"}
}
json_bytes = json.dumps(sample_meta).encode('utf-8')
trailer = json_bytes + b'\x00\x00\x00\x00\x00\x00\x00\x00FWx0\x12\x34\x56\x78\x01\x00\x00\x00\x00\x01\x00\x00'
simulated_file = sample_fw + trailer

def extract_fwtool_json(data):
    tail = data[-65536:] if len(data) > 65536 else data
    # Search for start of JSON
    idx = tail.find(b'{"metadata_version"')
    if idx == -1:
        idx = tail.find(b'{"compat_version"')
    if idx != -1:
        text = tail[idx:].decode('utf-8', errors='ignore')
        decoder = json.JSONDecoder()
        obj, _ = decoder.raw_decode(text)
        return obj
    return None

meta = extract_fwtool_json(simulated_file)
print("Extracted meta:", meta)
assert meta is not None
assert meta["compat_version"] == "1.1"
print("SUCCESS WITH RAW_DECODE!")
