# @arcanewizards/sigil

## 0.2.0

### Minor Changes

- c274364: Introduce a new `ShowFileConfig` component

  Introduce a new component for the UI / frontend for consistently managing show
  files across sigil-based apps. The first usage of this component will be in
  Arcane Desktop, but additional usages (e.g. timecode-toolbox) are expected
  later on.

### Patch Changes

- c274364: Expand user-actions module with more utilities
  - `ActionResponse` type, designed to allow for more rich error messages from
    e.g. server actions
  - `mapUserActionState` (basic functional map function over `UserActionState`)
  - `useUserAction` - a react hook for managing state relating to user actions
    and promise-based calls

- c274364: Add sigil-grid tailwind utility classes
- c274364: Add vAligh attribute to ControlLabel
- c274364: Introduce ControlFileButton component

  This is a special-case of a ControlButton,
  designed to load files from the users' system.

## 0.1.12

### Patch Changes

- a928575: Introduce a new UpdateDetails component for release notes
- 4d6879f: Clear the update state when checkForUpdates is disabled
- 19c0ae4: Introduce new components related to user actions
  - UserAction related types (loaded, idle, success, error)
  - new Spinner component
  - new Alert components
  - new LoadingWrapper and UserActionAlert components

- 37d7c04: Export utils module and apiContentToReact
- a928575: Migrate UpdateBanner component from `timecode-toolbox`
- cf23d63: Migrate UpdateChecker into sigil package
- 19c0ae4: Add & fix some new Tailwind spacing variables
- 5c29ceb: Allow for UpdateBanner and UpdateDetails classes to be customized
- Updated dependencies [19c0ae4]
- Updated dependencies [a928575]
- Updated dependencies [19c0ae4]
  - @arcanewizards/apis@0.0.2

## 0.1.11

### Patch Changes

- 4e80657: Fix arrow-enter bug in ControlInput / InputWithDelayedPropagation

  Previously, when an arrow key was used to edit an input
  (e.g. pressing up/down in a number input)
  enterPressed would be sent as true. This fixes that bug now so it will not be
  true when an arrow key is pressed.

  Also make sure that when a user presses Enter,
  that an onChange event is fired even if the value has not changed
  so that the UI can effectively respond to this to e.g. close dialog windows.

## 0.1.10

### Patch Changes

- a65eaac: Allow debugger text to be selected

  Previously, it wasn't possible to select the text from the Debug Tools window,
  making copying sections of the log, or the system paths, difficult.

- 1fa54e5: Some minor updates to ControlInput & InputWithDelayedPropagation
  - Introduce a hasError property on ControlInput
  - Allow Esc key to reset value to last value provided by the prop

## 0.1.9

### Patch Changes

- 04a01dc: Fix media session in browser windows

  Fix a bug where `createBrowserMediaSession()` was called multiple times,
  leading to apps being unable to register handlers correctly when run
  in the browser.

## 0.1.8

### Patch Changes

- 661bff4: Refactor close confirmation API

  Make it possible for electron apps to block closing windows properly by
  listening to the `close` event,
  by introducing a new API for registering window close confirmation behavior.

## 0.1.7

### Patch Changes

- 858eb09: Allow using hint with sigilColorUsage

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
