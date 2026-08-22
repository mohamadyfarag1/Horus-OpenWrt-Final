#!/bin/sh
echo "Software Reset Button Poller (Debug Mode) Activated."
echo "Press and hold the reset button for 5 seconds to factory reset,"
echo "Or press shortly to reboot."

pressed=0
seen=0

while true; do
    # Read from kernel debug directly since the pin is claimed by the dead kernel driver!
    val=$(cat /sys/kernel/debug/gpio | grep "gpio63 " | grep -c "low")
    
    if [ "$val" = "1" ]; then
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