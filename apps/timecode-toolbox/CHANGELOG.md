# @arcanewizards/timecode-toolbox

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
