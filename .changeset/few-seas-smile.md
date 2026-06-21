---
'@arcanewizards/timecode-toolbox': patch
---

Better handling of native module loading errors

When there are issues loading the native `midi` module,
catch the errors and log appropriately,
and display an error on the relevant inputs and outputs.
