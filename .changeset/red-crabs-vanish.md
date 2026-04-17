---
'@arcanewizards/timecode-toolbox': patch
---

Allow for the main port used by timecode-toolbox to be configured

Timecode-Toolbox will use attempt to find an open port in a range
on all interfaces by default,
but now users can customize the interface and port or range of ports
that the app uses for its websocket & browser UI.

Port config can be overridden with the PORT variable
