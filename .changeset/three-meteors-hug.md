---
'@arcanewizards/artnet': patch
'@arcanewizards/tcnet': patch
---

Use new `bindSocket` utility from net-utils

Use the newly migrated shared `bindSocket` function from `net-utils` instead
of independently declaring it in the `artnet` and `tcnet` packages.
