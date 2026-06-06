---
'@arcanewizards/sigil': patch
---

Fix arrow-enter bug in ControlInput / InputWithDelayedPropagation

Previously, when an arrow key was used to edit an input
(e.g. pressing up/down in a number input)
enterPressed would be sent as true. This fixes that bug now so it will not be
true when an arrow key is pressed.

Also make sure that when a user presses Enter,
that an onChange event is fired even if the value has not changed
so that the UI can effectively respond to this to e.g. close dialog windows.
