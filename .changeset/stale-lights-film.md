---
'@arcanewizards/timecode-toolbox': patch
---

Improve usability of Delay config

- Make it clear that delay field can also be used for an offset
- Highlight either Offset or Delay, depending on whether the value is negative
  or positive.
- Allow users to enter offsets/delays using a timecode format,
  and display this by default in the config options

fixes #78
