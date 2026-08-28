m = Map("radius_sync", translate("RADIUS Sync Settings"), translate("Configure connection details for SAS, DMA, ADV, or ICM servers."))

s = m:section(TypedSection, "settings", translate("General Settings"))
s.anonymous = true

e = s:option(Flag, "enabled", translate("Enable RADIUS Sync"))
e.rmempty = false

rtype = s:option(ListValue, "radius_type", translate("RADIUS Type"))
rtype:value("sas", "SAS")
rtype:value("dma", "DMA")
rtype:value("adv", "ADV")
rtype:value("icm", "ICM")
rtype.default = "sas"

url = s:option(Value, "base_url", translate("Base URL"), translate("e.g. http://192.168.1.10:8000"))
url.rmempty = false

usr = s:option(Value, "username", translate("Username"), translate("Required for SAS/ADV/ICM"))
usr:depends("radius_type", "sas")
usr:depends("radius_type", "adv")
usr:depends("radius_type", "icm")

pwd = s:option(Value, "password", translate("Password"))
pwd.password = true
pwd:depends("radius_type", "sas")
pwd:depends("radius_type", "adv")
pwd:depends("radius_type", "icm")

key = s:option(Value, "api_key", translate("API Key / Master Key"), translate("Required for DMA or ADV Master Key"))
key.password = true
key:depends("radius_type", "dma")
key:depends("radius_type", "adv")
key:depends("radius_type", "icm")

interval = s:option(Value, "sync_interval", translate("Sync Interval (Seconds)"))
interval.default = "60"
interval.datatype = "uinteger"

return m
