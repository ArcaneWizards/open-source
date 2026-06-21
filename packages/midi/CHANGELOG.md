# @arcanewizards/midi

## 0.1.1

### Patch Changes

- 9e8d4c6: Introduce multi-arch MacOS build to allow for cross-compiled apps

  Previously this package would only build native modules in the same architecture
  as the host machine. This meant that cross-compiled electron apps
  (e.g. timecode toolbox x64 built on arm64) would not have the appropriate
  native code available for use.

  This change now ensures that both arm64 and x64 architectures are built when
  installed on MacOS, allowing for cross-compiled electron apps to be loaded
  properly.

## 0.1.0

### Minor Changes

- 816aa78: Introduce initial version of MIDI package

### Patch Changes

- 3e62576: Correct type capitalization
- 3e62576: Ensure device changes update state

  Ensure that when MIDI devices are hotplugged, or virtual devices are created or
  removed, that the list of inputs and outputs will return an up-to-date view.
