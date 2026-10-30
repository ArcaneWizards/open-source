---
'@arcanewizards/smpte': minor
'@arcanewizards/ltc': minor
---

[breaking] require `smpteMode` for stopped `SMPTETimecodePlayState`

The `SMPTETimecodePlayState` type now requires the SMPTE mode to be specified
when in a stopped state. `null` can be provided in cases where this information
isn't available (e.g. a timecode initialized to `00:00:00:00` with no playback).
