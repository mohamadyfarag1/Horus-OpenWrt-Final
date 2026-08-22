#!/bin/sh
echo "Monitoring all GPIOs for button press... PRESS THE RESET BUTTON NOW!"
cat /sys/kernel/debug/gpio > /tmp/gpio_base
i=0
while [ $i -le 40 ]; do
    cat /sys/kernel/debug/gpio > /tmp/gpio_new
    grep -v -F -f /tmp/gpio_base /tmp/gpio_new
    sleep 1
    i=$((i+1))
done
echo "Done."