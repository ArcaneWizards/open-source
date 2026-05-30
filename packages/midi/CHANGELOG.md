# @arcanewizards/midi

## 0.1.0

### Minor Changes

- 816aa78: Introduce initial version of MIDI package

### Patch Changes

- 3e62576: Correct type capitalization
- 3e62576: Ensure device changes update state

  Ensure that when MIDI devices are hotplugged, or virtual devices are created or
  removed, that the list of inputs and outputs will return an up-to-date view.
