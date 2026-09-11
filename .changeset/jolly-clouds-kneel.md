---
'@arcanewizards/timecode-toolbox': patch
---

Use Bonjour to request local network access

MacOS was still not showing a prompt to request local network access when users
try to use TCNet. This changes introduces use of Apple's Bonjour framework to
try and encourage MacOS to display a local network request prompt.
