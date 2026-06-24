---
'@arcanewizards/timecode-toolbox': patch
---

Improve MacOS MIDI integration & Properly shut-down (#130)

- Properly tear-down the MIDI module during shutdown.
- Allow the MIDI module to produce log messages
- Only initialize a single instance using midi()
