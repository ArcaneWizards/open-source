# @arcanewizards/timecode-toolbox

## 0.4.1

### Patch Changes

- 9e8d4c6: Address react render errors/warnings

  Address some warnings and errors that were printed directly to the stdout
  in the timecode toolbox process, mostly related to missing keys and
  invalid calls to setState within render methods.

- 9e8d4c6: Better handling of native module loading errors

  When there are issues loading the native `midi` module,
  catch the errors and log appropriately,
  and display an error on the relevant inputs and outputs.

- 9e8d4c6: Fix MIDI usage in Intel Macs

  An issue with the native MIDI module meant that the app crashed when MIDI
  inputs or outputs were created, this should now be addressed.

- Updated dependencies [9e8d4c6]
  - @arcanewizards/midi@0.1.1

## 0.4.0

### Minor Changes

- 3acf75c: Add support for LTC Inputs & Outputs

  You can now select audio devices & specific channels to input / output
  Linear Timecode from/to, with the usual Frame-Rate & Delay/Offset options,
  and taking into account playback speed.

  For now, Input is limited to 2 channels (due to chromium / electron limitations),
  however some users may be able to get round this
  (e.g. if using Firefox and connecting to the remote port).

### Patch Changes

- 4e80657: Allow Audio Player Volume Changes

  Allow users to adjust the playback volume for Audio Player generators.
  This control is a per-device setting that will only reflect configuration for
  local playback, but will be synchronized across all windows for a particular
  device, regardless as to whether they're accessed remotely or via the
  application windows.

- 8c81e94: Allow for Audio Output Device Selection

  Allow for users to configure audio players to go to specific audio output devices,
  this allows for multiple players to go to different outputs on the same device.

  This configuration option is like audio volume,
  and only affects the current device being interacted with.

- 4e80657: Allow Audio Player generator speed changes

  Audio Players can now be configured with specific speeds,
  which is a configuration option that applies to any device that may be playing
  the audio.

  For example if the audio is being played remotely,
  and speed is configured from the local device,
  the remote device will immediately change playback speed.

## 0.3.1

### Patch Changes

- a65eaac: Allow debugger text to be selected

  Previously, it wasn't possible to select the text from the Debug Tools window,
  making copying sections of the log, or the system paths, difficult.

- 5d6029f: Introduce system clock generator

  Allow users to configure a clock generator to use the system time rather than
  have controlled playback. Users can also select different timezones to the
  default system timezone.

- 05fa056: Keep player running when settings/debugger/info opened

  Previously, when opening any of the other app windows while music was playing,
  the music would stop without any warning. Now it continues playing in the
  background.

  fixes 82

- fb725fa: Add more config metadata to timecodes UI
  - ArtNet & TCNet Inputs now display interface name & IP address
  - ArtNet Outputs now display interface name & IP address, or hostname
  - MIDI Inputs & Outputs now display device type (virtual vs physical)
    and device name
  - System clock generators now show timezone when it's different to
    system clock

  All this information is displayed at the top of the timecode alongside
  the name. If a name is set, that will be shown first (to the left),
  with the metadata shown after. If no name is set,
  the metadata is shown to the left of the placeholder.

- 1fa54e5: Improve usability of Delay config
  - Make it clear that delay field can also be used for an offset
  - Highlight either Offset or Delay, depending on whether the value is negative
    or positive.
  - Allow users to enter offsets/delays using a timecode format,
    and display this by default in the config options

  fixes #78

## 0.3.0

### Minor Changes

- 0dfacd9: Introduce MIDI Timecode (MTC)

  It's now possible for you to connect MIDI devices
  (and create virtual devices on MacOS) that allows you to send MIDI timecode
  signals as outputs, and receive them as inputs.

  Right now this feature is only supported on Windows and MacOS,
  but linux support for our CLI users will come at some point in the future.

### Patch Changes

- c63004c: Required Action: Correct Application folder in Windows

  On windows, Timecode Toolbox was incorrectly using the folder `ArcaneDesktop` to
  install itself, which was incorrect and conflicting with our other application
  that's currently in early-access.

  This will probably mean that when you install this version, the existing version
  will remain installed, which will require you to manually uninstall it yourself.

- cd35667: Introduce clearer messages for misconfigured Art-Net
  - Display a warning when broadcast is configured for a loopback interface
  - Display a warning when no interface has been selected

- Updated dependencies [3e62576]
- Updated dependencies [3e62576]
- Updated dependencies [816aa78]
  - @arcanewizards/midi@0.1.0

## 0.2.1

### Patch Changes

- 4d71081: Add links to help and support pages

## 0.2.0

### Minor Changes

- 04a01dc: Implement local audio player generator (#54)

  Implement a brand new feature that allows for music files to be loaded into
  the app, and used as a timecode source. Players can load music on the same
  device, or remotely via a web browser. Multiple devices are also able to
  control playback regardless as to which device is playing the music.

- 04a01dc: Allow delay to be added to clock generators

### Patch Changes

- 588a2e7: Update electron and dependencies

  Update electron from v33 to v41, addressing a number of security vulnerabilities
  in addition to security updates from other dependencies in use by the app.

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
