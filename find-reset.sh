#!/bin/sh
g=0
while [ $g -le 60 ]; do
    echo $g > /sys/class/gpio/export 2>/dev/null
    g=$((g+1))
done

sleep 1

g=0
while [ $g -le 60 ]; do
    if [ -e "/sys/class/gpio/gpio$g/direction" ]; then
        echo "in" > /sys/class/gpio/gpio$g/direction 2>/dev/null
        cat /sys/class/gpio/gpio$g/value 2>/dev/null > /tmp/gpio_init_$g
    fi
    g=$((g+1))
done

echo "Please PRESS AND HOLD the RESET button NOW! (You have 15 seconds)"
detected=""
i=0
while [ $i -le 30 ]; do
    g=0
    while [ $g -le 60 ]; do
        if [ -e "/sys/class/gpio/gpio$g/value" ] && [ -f "/tmp/gpio_init_$g" ]; then
            val=$(cat /sys/class/gpio/gpio$g/value 2>/dev/null)
            init=$(cat /tmp/gpio_init_$g)
            if [ "$val" != "$init" ] && [ -n "$val" ]; then
                detected=$g
                break 2
            fi
        fi
        g=$((g+1))
    done
    sleep 0.5
    i=$((i+1))
done

if [ -n "$detected" ]; then
    echo "BINGO! Reset button is on GPIO $detected"
else
    echo "No change detected. Did you press the button?"
fi

g=0
while [ $g -le 60 ]; do
    echo $g > /sys/class/gpio/unexport 2>/dev/null
    g=$((g+1))
done