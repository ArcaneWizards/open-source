---
'@arcanewizards/timecode-toolbox': patch
---

Improve app stability by preventing unexpected errors crashing app

Previously, minor logical errors,
or intermittent Network, MIDI errors etc...
would cause the entire app to crash.
Now it will be logged to the debugger instead,
and errors can be seen and shared with others.

This was implemented by updating `@arcanewizards/sigil`,
which now handles this by default.
