import os

files = [
    "scripts/07-unlock-superchannel.sh",
    "scripts/09-generate-regdb.sh",
    "scripts/06-compile.sh",
    "config/horus.config"
]

for f in files:
    try:
        with open(f, "rb") as file:
            content = file.read()
        content = content.replace(b"\r\n", b"\n")
        with open(f, "wb") as file:
            file.write(content)
        print(f"Fixed {f}")
    except Exception as e:
        print(f"Failed {f}: {e}")
