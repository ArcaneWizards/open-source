# @arcanewizards/midi-timecode

## 0.2.0

### Minor Changes

- 874ebc2: [breaking] - remove deprecated SMPTE types:
  - `MIDITimecodePlayState` has been replaced by `SMPTETimecodePlayState`
    from the `@arcanewizards/smpte` package
  - `MIDISMPTEMode` has been replaced by `SMPTETimecodeMode;`
    from the `@arcanewizards/smpte` package

  For convenience, the `@arcanewizards/midi-timecode` package re-exports these
  types so you don't need to separately install `@arcanewizards/smpte`.

- 874ebc2: [breaking] - remove mode and require it to be set when changing state

  For more consistency with the `@arcanewizards/smpte` API,
  and to avoid bust like https://github.com/ArcaneWizards/open-source/issues/119 -
  the SMPTE mode is now always taken from the `SMPTETimecodePlayState`
  passed in to `setPlayState`.

  Also fixes https://github.com/ArcaneWizards/open-source/issues/119

### Patch Changes

- Updated dependencies [874ebc2]
  - @arcanewizards/smpte@0.2.0

## 0.1.1

### Patch Changes

- 3acf75c: Define generic timecode type within SMPTE package
- 3acf75c: Correct dependencies

  Avoid building smpte directly into package,
  and instead import it from the installed dependencies.

- Updated dependencies [3acf75c]
  - @arcanewizards/smpte@0.1.1

## 0.1.0

### Minor Changes

- c63004c: Initial implementation of package
