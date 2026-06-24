---
'@arcanewizards/timecode-toolbox': patch
---

Fix bug in windows, prevent multiple simultaneous instances (#131)

Previously, it was possible to launch multiple instances of Timecode Toolbox on
windows, resulting in multiple icons in the system tray that would need to be
individually closed, and potentially resulting in interference on TC protocols,
or inability to listen to interfaces.

This is now prevented, and only one instance of Timecode Toolbox may be run at
any one time.

fixes #131
