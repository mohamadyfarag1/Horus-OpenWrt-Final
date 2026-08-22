#!/bin/sh
echo 63 > /sys/class/gpio/export 2>/dev/null
echo "in" > /sys/class/gpio/gpio63/direction 2>/dev/null

echo "Software Reset Button Poller Activated."
echo "Press and hold the reset button for 5 seconds to factory reset,"
echo "Or press shortly to reboot."

pressed=0
seen=0

while true; do
    val=$(cat /sys/class/gpio/gpio63/value 2>/dev/null)
    
    if [ "$val" = "0" ]; then
        if [ $pressed -eq 0 ]; then
            echo "Button PRESSED!"
            pressed=1
            seen=0
            ACTION=pressed BUTTON=reset SEEN=$seen /etc/rc.button/reset
        else
            seen=$((seen + 1))
            if [ $seen -eq 5 ]; then
                echo "Button held for 5 seconds! Triggering FAILSAFE/RESET!"
            fi
        fi
    else
        if [ $pressed -eq 1 ]; then
            echo "Button RELEASED after $seen seconds!"
            pressed=0
            ACTION=released BUTTON=reset SEEN=$seen /etc/rc.button/reset
        fi
    fi
    sleep 1
done