---
'@arcanewizards/timecode-toolbox': patch
---

Use native MacOS API to request local network access

On some macs, despite the 2 releases since 0.4.7,
local network access was still blocked.

We're now trying a different approach to request local network access when it's
needed that should, hopefully, resolve the issue
