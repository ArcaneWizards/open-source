---
'@arcanewizards/clx': patch
---

Report time/length precision as 1ms

Avoid a situation where floating-point-comparisons may consider a timecode track
to be for a different song, even though the length will be within 1ms and track
metadata matching.
