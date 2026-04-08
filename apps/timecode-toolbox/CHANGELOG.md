# @arcanewizards/timecode-toolbox

## 0.1.0

### Minor Changes

- 046e311: Allow timecode-toolbox to be run from cli

  Introduce a "bin" entry to allow for the package to be installed via npx,
  or globally, and executed easily on a host machine.

### Patch Changes

- 109936d: Correct dependencies in timecode-toolbox

  Certain dev dependencies were incorrectly listed as normal dependencies,
  meaning they would be incorrectly installed.

## 0.0.3

### Patch Changes

- Introduce Appearance Settings

  Make it possible to choose between light/dark/os mode,
  and to pick a primary interface color.

- Introduce new clock generator

  Introduce a new generator that uses the local time of the system clock,
  and can be started, stopped, reset etc...

  This can be connected to an output like all the existing inputs.

- Allow individual timecodes to be opened in new window

  For cases where users want to be able to focus on one particular timecode,
  or have complex multi-window / workspace. /monitor setups where they want to be
  able to display specific timecodes in different places,
  it's now possible to open a specific timecode in a new window.
