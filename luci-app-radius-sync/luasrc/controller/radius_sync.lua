module("luci.controller.radius_sync", package.seeall)

function index()
    -- Tab for settings
    entry({"admin", "services", "radius_sync"}, cbi("radius_sync/settings"), _("RADIUS Sync"), 60)
    -- Tab for Dashboard
    entry({"admin", "services", "radius_sync", "dashboard"}, template("radius_sync/dashboard"), _("Dashboard"), 1)
    
    -- AJAX Endpoint for Dashboard data
    entry({"admin", "services", "radius_sync", "status"}, call("action_status"))
end

function action_status()
    local fs = require "nixio.fs"
    local json = require "luci.jsonc"
    
    local content = fs.readfile("/tmp/radius_users.json") or "{}"
    local data = json.parse(content) or { error = "No data available or daemon not running" }
    
    luci.http.prepare_content("application/json")
    luci.http.write_json(data)
end
