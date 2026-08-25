import os

with open(".github/workflows/build.yml", "r") as f:
    text = f.read()

start = text.find("# Inject PSGMII fix directly into QCA8K driver")
end = text.find("done", start) + 4
if start != -1:
    text = text[:start] + text[end:]
    
target = "make -j$(nproc) || { make -j1 V=s 2>&1 | tee build.log; exit ${PIPESTATUS[0]}; }"
new_seq = """make target/linux/prepare V=s
          # Inject PSGMII fix directly into QCA8K driver after extracting kernel
          for f in $(find build_dir/ -path "*/drivers/net/dsa/qca/qca8k*c" 2>/dev/null); do
              sed -i 's/retries < 100/retries < 1/g' "$f"
              sed -i 's/retries < 10 /retries < 1 /g' "$f"
              echo "Patched PSGMII boot delay loop in: $f"
          done
          make -j$(nproc) || { make -j1 V=s 2>&1 | tee build.log; exit ${PIPESTATUS[0]}; }"""

if target in text:
    text = text.replace(target, new_seq)
    with open(".github/workflows/build.yml", "w") as f:
        f.write(text)
    print("Done!")
else:
    print("Target not found")
