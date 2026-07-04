---
'@arcanewizards/tcnet': patch
---

Fix TCNet time port binding on MacOS

The fix for #70 (f65c6ee) accidentally broke the ability for MacOS to receive
time packets from TCNet,
meaning that `createTCNetTimecodeMonitor` was also broken.
