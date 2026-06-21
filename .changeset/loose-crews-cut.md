---
'@arcanewizards/timecode-toolbox': patch
---

Fix MIDI usage in Intel Macs

An issue with the native MIDI module meant that the app crashed when MIDI
inputs or outputs were created, this should now be addressed.
