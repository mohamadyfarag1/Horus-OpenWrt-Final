import urllib.request
import difflib
import os

def fetch(url):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        return response.read().decode("utf-8")

regd_url = "https://raw.githubusercontent.com/torvalds/linux/v6.6/drivers/net/wireless/ath/regd.c"
reg_url = "https://raw.githubusercontent.com/torvalds/linux/v6.6/net/wireless/reg.c"

regd_orig = fetch(regd_url)
reg_orig = fetch(reg_url)

regd_new = regd_orig.replace(
    "REG_RULE(5150-10, 5350+10, 80, 0, 30,", 
    "REG_RULE(4900-10, 6100+10, 160, 0, 33,"
).replace(
    "REG_RULE(5470-10, 5850+10, 80, 0, 30,", 
    "REG_RULE(4900-10, 6100+10, 160, 0, 33,"
).replace(
    "REG_RULE(5725-10, 5850+10, 80, 0, 30,", 
    "REG_RULE(4900-10, 6100+10, 160, 0, 33,"
).replace(
    "REG_RULE(2412-10, 2462+10, 40, 0, 20, 0)",
    "REG_RULE(2192-10, 2732+10, 40, 0, 33, 0)"
).replace(
    "REG_RULE(2467-10, 2472+10, 40, 0, 20,",
    "REG_RULE(2192-10, 2732+10, 40, 0, 33,"
).replace(
    "REG_RULE(2484-10, 2484+10, 40, 0, 20,",
    "REG_RULE(2484-10, 2484+10, 40, 0, 33,"
).replace(
    "NL80211_RRF_NO_IR | NL80211_RRF_AUTO_BW", "0"
).replace(
    "NL80211_RRF_NO_IR", "0"
).replace(
    "NL80211_RRF_NO_OFDM", "0"
)

reg_new = reg_orig.replace(
    "REG_RULE(2412-10, 2462+10, 40, 6, 20, 0)",
    "REG_RULE(2192-10, 2732+10, 40, 6, 33, 0)"
).replace(
    "REG_RULE(2467-10, 2472+10, 20, 6, 20,",
    "REG_RULE(2192-10, 2732+10, 40, 6, 33,"
).replace(
    "REG_RULE(2484-10, 2484+10, 20, 6, 20,",
    "REG_RULE(2484-10, 2484+10, 40, 6, 33,"
).replace(
    "NL80211_RRF_NO_IR | NL80211_RRF_AUTO_BW", "0"
).replace(
    "NL80211_RRF_NO_IR", "0"
).replace(
    "NL80211_RRF_NO_OFDM", "0"
)

# For is_valid_rd, we just replace the function body to return true
reg_new = reg_new.replace(
    "static bool is_valid_rd(const struct ieee80211_regdomain *rd)\n{",
    "static bool is_valid_rd(const struct ieee80211_regdomain *rd)\n{\n\treturn true;"
)

def make_diff(orig, new, filename):
    diff = list(difflib.unified_diff(
        orig.splitlines(keepends=True),
        new.splitlines(keepends=True),
        fromfile=f"a/{filename}",
        tofile=f"b/{filename}"
    ))
    return "".join(diff)

patch_content = ""
patch_content += make_diff(regd_orig, regd_new, "drivers/net/wireless/ath/regd.c")
patch_content += make_diff(reg_orig, reg_new, "net/wireless/reg.c")

with open("999-unlock-superchannel.patch", "w", newline="\n") as f:
    f.write(patch_content)

print("Patch generated successfully.")
