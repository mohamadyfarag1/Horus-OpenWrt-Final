#!/bin/sh
# Helper script to get uspot clients in JSON format
# If uspot has a ubus method, we try that first
res=$(ubus call uspot clients 2>/dev/null)
if [ -n "$res" ]; then
    echo "$res"
else
    # Fallback empty JSON array if not found
    echo '{"clients": []}'
fi
