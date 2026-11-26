# @arcanewizards/smpte

## 0.2.1

### Patch Changes

- ace4482: Include totalFrames in output for conversion from millis

  `getTimecodeFromMillis` and `getDropFrameTimecode` now both output a
  `totalFrames` value too so that the total number of frames since timecode `0`
  can also be determined.

## 0.2.0

### Minor Changes

- 874ebc2: [breaking] require `smpteMode` for stopped `SMPTETimecodePlayState`

  The `SMPTETimecodePlayState` type now requires the SMPTE mode to be specified
  when in a stopped state. `null` can be provided in cases where this information
  isn't available (e.g. a timecode initialized to `00:00:00:00` with no playback).

## 0.1.1

### Patch Changes

- 3acf75c: Define generic timecode type within SMPTE package

## 0.1.0

### Minor Changes

- c63004c: Initial implementation of package

  Extract common utilities and constants from the `@arcanewizards/artnet` package
  so it can be used with other SMPTE-based protocols (namely MIDI)
