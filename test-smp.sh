#!/bin/sh
/etc/init.d/irqbalance stop 2>/dev/null
/etc/init.d/irqbalance disable 2>/dev/null

echo "Distributing Wi-Fi IRQs to all 4 cores (f)..."
for irq in $(grep -i ath10k /proc/interrupts | awk '{print $1}' | tr -d ':'); do
    echo f > /proc/irq/$irq/smp_affinity
done

echo "Before test:"
cat /proc/interrupts | grep -i ath10k

echo "Waiting 10 seconds to collect new traffic..."
sleep 10

echo "After test (Look at the numbers on all 4 CPUs!):"
cat /proc/interrupts | grep -i ath10k