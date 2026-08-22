#!/usr/bin/env python3
import time
import os

# Initialize GPIOs
gpios = list(range(0, 100))
valid_gpios = []
for g in gpios:
    try:
        with open("/sys/class/gpio/export", "w") as f:
            f.write(str(g))
    except Exception:
        pass

time.sleep(0.5)

# Set to input
for g in gpios:
    if os.path.exists(f"/sys/class/gpio/gpio{g}/direction"):
        valid_gpios.append(g)
        try:
            with open(f"/sys/class/gpio/gpio{g}/direction", "w") as f:
                f.write("in")
        except:
            pass

# Read initial states
initial_states = {}
for g in valid_gpios:
    try:
        with open(f"/sys/class/gpio/gpio{g}/value", "r") as f:
            initial_states[g] = f.read().strip()
    except:
        pass

print("Please PRESS AND HOLD the RESET button NOW! (You have 10 seconds)")
print("Monitoring GPIOs for changes...")

# Poll for changes
detected = None
start_time = time.time()
while time.time() - start_time < 10:
    for g in valid_gpios:
        try:
            with open(f"/sys/class/gpio/gpio{g}/value", "r") as f:
                val = f.read().strip()
                if val != initial_states.get(g):
                    detected = g
                    break
        except:
            pass
    if detected is not None:
        break
    time.sleep(0.1)

if detected is not None:
    print(f"BINGO! Reset button is on GPIO {detected}")
else:
    print("No change detected. Did you press the button?")

# Cleanup
for g in valid_gpios:
    try:
        with open("/sys/class/gpio/unexport", "w") as f:
            f.write(str(g))
    except:
        pass