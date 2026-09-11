import keyboard
import time

print("=== Keyboard Test Tool ===")
print("Type anything... (Press ESC to exit)")
print()

# Test specific keys
test_keys = [
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
    'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
    'u', 'v', 'w', 'x', 'y', 'z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    'space', 'enter', 'backspace', 'tab', 'shift', 'ctrl',
    'alt', 'caps lock', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6',
    'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
    'up', 'down', 'left', 'right',
    'delete', 'home', 'end', 'page up', 'page down'
]

working_keys = []
not_working_keys = []

print("Keyboard test shuru ho raha hai...")
print("Saari keys press karo one by one (2 second wait)")
print()

for key in test_keys:
    try:
        keyboard.wait(key, timeout=2)
        working_keys.append(key)
        print(f"[WORKING] {key}")
    except:
        not_working_keys.append(key)
        print(f"[NOT WORKING] {key}")

print("\n=== TEST RESULTS ===")
print(f"\nWorking Keys ({len(working_keys)}):")
for k in working_keys:
    print(f"  + {k}")

print(f"\nNot Working Keys ({len(not_working_keys)}):")
for k in not_working_keys:
    print(f"  - {k}")

if not not_working_keys:
    print("\nAll keys are working!")
else:
    print(f"\n{len(not_working_keys)} keys are not working!")

input("\nPress Enter to exit...")
