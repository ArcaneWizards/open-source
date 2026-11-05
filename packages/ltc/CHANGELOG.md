# @arcanewizards/ltc

## 0.1.1

### Patch Changes

- 0c1b802: Avoid splicing the LTC writer output on small timeline adjustments

  Play state updates that shift the timeline by up to 10ms (such as clock-sync
  jitter between the browser and server) are now slewed in gradually instead of
  jumping the waveform mid-frame. Previously each adjustment produced a frame with
  the wrong number of bits, which LTC readers would drop or misread as an
  unrelated timecode.

## 0.1.0

### Minor Changes

- 874ebc2: [breaking] require `smpteMode` for stopped `SMPTETimecodePlayState`

  The `SMPTETimecodePlayState` type now requires the SMPTE mode to be specified
  when in a stopped state. `null` can be provided in cases where this information
  isn't available (e.g. a timecode initialized to `00:00:00:00` with no playback).

- 75b0d1b: Publish LTC Package

  We had neglected to bump the version since finishing the implementation of this
  package,
  and as such users could build their own apps on-top of this library.

### Patch Changes

- Updated dependencies [874ebc2]
  - @arcanewizards/smpte@0.2.0
