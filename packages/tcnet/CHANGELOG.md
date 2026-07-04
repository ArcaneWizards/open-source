# @arcanewizards/tcnet

## 0.1.5

### Patch Changes

- 044cb5f: Fix weighting metadata calculation with definitive trackId

  There was a bug with the logic for determining correct metadata when trackID
  is supplied by TCNet server (e.g. ShowKontrol).

  Furthermore, there's a bug in ShowKontrol where old metadata will be returned
  with the new trackId, so added some comments around how we can't rely on that
  alone.

- 0a5f769: Fix TCNet time port binding on MacOS

  The fix for #70 (f65c6ee) accidentally broke the ability for MacOS to receive
  time packets from TCNet,
  meaning that `createTCNetTimecodeMonitor` was also broken.

- a694965: Add support for mixer fader, trim and crossfade values

  Latest version of ShowKontrol (v26.5.12) is now correctly outputting mixer
  fader values, along with trim and crossfader assignment.
  This data is now all parsed and added to the interface for client consumption.

- a694965: Stop printing warnings for supplied trackId

  Newer versions of ShowKontrol are correctly supplying trackId information
  within METADATA packets,
  so when they are provided, they can be used directly instead of weighting the
  responses based on which track IDs we think are loaded.

## 0.1.4

### Patch Changes

- f65c6ee: Fix tcnet port binding on windows (#70)

## 0.1.3

### Patch Changes

- 7ddc46b: Include license in package files
- Updated dependencies [7ddc46b]
  - @arcanewizards/net-utils@0.1.3

## 0.1.2

### Patch Changes

- aadf8ef: Introduce README
- Updated dependencies [aadf8ef]
  - @arcanewizards/net-utils@0.1.2

## 0.1.1

### Patch Changes

- Initial Changeset Bumped Version
