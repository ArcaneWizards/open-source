---
'@arcanewizards/clx': patch
---

Better handling of 0-length tracks

- Also correctly handle +/-Infinity values for NormalizedPosition
  (not just NaN)
- When a track has a length of 0, ensure that totalTime is not present
  (as with SMPTE timecodes).
