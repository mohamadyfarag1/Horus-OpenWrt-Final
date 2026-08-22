#!/bin/sh
echo "=== Network Loop Check (STP) ==="
brctl showstp br-lan | awk '{
  if ($0 ~ /^[a-zA-Z0-9_-]+ \([0-9]+\)/) {
    port = $1
  } else if ($0 ~ /state/) {
    state = $NF
    if (state == "blocking") {
      print "🚨 [BLOCKED] Port " port " has a LOOP and is BLOCKED for safety!"
    } else if (state == "forwarding") {
      print "✅ [OK] Port " port " is working normally."
    } else if (state == "disabled") {
      print "🔌 [OFF] Port " port " is unplugged or disabled."
    }
  }
}'