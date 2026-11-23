---
'@arcanewizards/smpte': patch
---

Include totalFrames in output for conversion from millis

`getTimecodeFromMillis` and `getDropFrameTimecode` now both output a
`totalFrames` value too so that the total number of frames since timecode `0`
can also be determined.
