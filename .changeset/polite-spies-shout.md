---
'@arcanewizards/midi-timecode': minor
---

[breaking] - remove deprecated SMPTE types:

- `MIDITimecodePlayState` has been replaced by `SMPTETimecodePlayState`
  from the `@arcanewizards/smpte` package
- `MIDISMPTEMode` has been replaced by `SMPTETimecodeMode;`
  from the `@arcanewizards/smpte` package

For convenience, the `@arcanewizards/midi-timecode` package re-exports these
types so you don't need to separately install `@arcanewizards/smpte`.
