---
'@arcanewizards/sigil': patch
---

Avoid calling setPositionState with bad position

Avoid calling `setPositionState` in browser media session with a position that
is less than 0 or greater than the duration of the loaded media.
