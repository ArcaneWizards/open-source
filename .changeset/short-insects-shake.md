---
'@arcanewizards/timecode-toolbox': patch
---

bug: Fix retransmission of paused / stopped timecode states (#128)

Previously, all SMPTE outputs (ArtNet, MTC & LTC) would intermittently
re-transmit frame information for paused timecodes
(such as when internal timing information changed).

This bug has now been addressed, so that frames are only transmitted if the
information being transmitted has actually changed,
and not only related data that doesn't affect the timecode timing.
