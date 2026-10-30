---
'@arcanewizards/sigil': patch
---

Add additional type-safety to additionalFiles

Make the type for the `additionalFiles` option stricter so that any
extension of the original files will require that the adhere to
ToolkitAdditionalFiles too.
