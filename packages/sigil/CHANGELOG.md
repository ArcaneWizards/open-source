# @arcanewizards/sigil

## 0.1.6

### Patch Changes

- ce37aec: Introduce new appListenerChangesHandledExternally property

  Introduce a new appListenerChangesHandledExternally property to the browser
  context that indicates to the frontend code if any changes to the app listener
  will be handled externally (by e.g. electron),
  or whether the frontend code should attempt to repair the URL manually.

- ce37aec: Introduce new network config zod types
- e684bc3: Introduce destructive buttons & increase dialog gap
  - Introduce a destructive mode to ControlButton to display buttons as red
  - Increase the gap between control buttons in dialogs

- 4b58c49: Prevent iOS zooming-in when focusing inputs

  Prevent the default behavior of iOS zooming in to small inputs
  (e.g. in timecode-toolbox when opening the edit dialog)

  see #34

- ce37aec: Prefer loopback (internal) interface in AppListenerManager

  When multiple application listeners are available,
  prefer the connection that's bound to an internal / loopback interface.

## 0.1.5

### Patch Changes

- 3d66107: Use label for ControlLabel

  This allows using the htmlFor prop to link the label to the input.

- 879ce15: Introduce ControlColoredSelect

  Generalize the functionality from ControlColorSelect
  so that it can be used for other types of select
  where each option has a color associated with it.

## 0.1.4

### Patch Changes

- 25a2f2b: Pull out styling hooks into own module

  To allow for the core styling module to be used in server components,
  pull out the hooks into their own module,
  so that useEffect will not be imported unless required.

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

- Initial version publication from Actions
- Updated dependencies
  - @arcanewizards/net-utils@0.1.1
