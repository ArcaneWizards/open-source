# @arcanewizards/timecode-toolbox

## 0.1.7

### Patch Changes

- 4755e41: Ensure TCNet errors are correctly displayed

  Previously only warnings were being displayed on the timecode itself,
  and you needed to go to the logs to see errors.

- f65c6ee: Fix port binding in inputs for windows (#70)

## 0.1.6

### Patch Changes

- 0d50503: Address Art-Net output loop forking.

  Maintaining a custom frame event loop using `setTimeout` caused previous
  ArtNet states to continue sending even though they should have stopped.

  This issue has now been addressed.

  fixes #66

## 0.1.5

### Patch Changes

- 858eb09: Correct some input/output mis-labelling
- 4fdb9d6: Make it more obvious when output/input is paused/disabled

  Replace the timecode display with a pause icon when an input/output is disabled,
  making it very clear when a timecode won't be sending/receiving a signal.

  Fixes #31

- 858eb09: Clearly display when an output is linked to something

  Previously, it wasn't obvious when an output was connected to an input or
  generator, and which input or generator was linked.

  This is now prominently displayed underneath the output type & name.

  Fixes #55

- 6d025db: Fix Art-Net Drift

  The previous implementation of our artnet timecode broadcast would regularly be
  out by about 1 frame, due to us not timing sending of the packets appropriately,
  and rounding down to the nearest frame when converting millisecond timecodes
  to frame timecodes.

  We now schedule appropriate timeouts based on when the next frame starts.

  Fixes #30

- e342d52: Display errors & warnings prominently

  Display any errors and warnings for inputs / outputs
  (such as network / connectivity issues)

  Fixes #59

## 0.1.4

### Patch Changes

- 9281c7c: Address browser access to desktop edition of timecode-toolbox (#33)
- e684bc3: Introduce delete buttons

  It's now possible to delete inputs, generators, and outputs.

- 4b58c49: Prevent iOS zooming-in when focusing inputs

  Prevent the default behavior of iOS zooming in to small inputs
  (e.g. in timecode-toolbox when opening the edit dialog)

  see #34

- ce37aec: Allow for the main port used by timecode-toolbox to be configured

  Timecode-Toolbox will use attempt to find an open port in a range
  on all interfaces by default,
  but now users can customize the interface and port or range of ports
  that the app uses for its websocket & browser UI.

  Port config can be overridden with the PORT variable

- 4d0e305: Fix icon size for some resolutions

  The icon generation for some resolutions seems to be an incorrect size. This
  change regenerates all icon images for timecode-toolbox.

- 4b58c49: Correct height on iOS devices

  When using a browser on iOS to connect to timecode-toolbox,
  Ensure that the full UI is visible.

## 0.1.3

### Patch Changes

- b091c07: Updated app icon to latest version
- b091c07: Flesh out README with a bit more information

## 0.1.2

### Patch Changes

- ec49a94: Add README to timecode-toolbox

## 0.1.1

### Patch Changes

- eb97d76: Add missing shebang for timecode-toolbox executable
- 7ddc46b: Include license in package files
- 7ddc46b: Remove source from package

  The source code was incorrectly included in the published npm package,
  this was bloating the package, and so now only specific files are published.

- 7ddc46b: Include license & source details in UI

  Introduce a new "license" view that displays the monorepo & package license.
  Also add links to the source code.

- 6517f17: Implement periodic check for updates

  Using a dedicated API endpoint,
  automatically check for updates periodically,
  and display a banner when an update is available,
  giving the user an appropriate link to download the latest version.

  This behavior can be configured in the app settings.

- 7ddc46b: Introduce a license gate on startup

  Require that users accept the disclaimer from the MIT license before
  being able to use the software

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
