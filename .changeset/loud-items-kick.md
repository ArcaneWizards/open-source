---
'@arcanewizards/midi': patch
---

Improve internal state management for MacOS

Keep better track of which endpoints and listeners are still in use,
and notify the native module when we no longer need to receive MIDI device
notifications.
