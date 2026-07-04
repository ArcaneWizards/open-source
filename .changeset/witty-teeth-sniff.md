---
'@arcanewizards/timecode-toolbox': patch
---

Fix TCNet / Pioneer / ShowKontrol integration on MacOS

A previous change to attempt to fix TCNet binding in Windows inadvertently broke
the MacOS implementation.

A proper fix has now been implemented, and tested with real Pioneer equipment and
the most recent version of ShowKontrol (v26.5.12).
