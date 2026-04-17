---
'@arcanewizards/sigil': patch
---

Introduce new appListenerChangesHandledExternally property

Introduce a new appListenerChangesHandledExternally property to the browser
context that indicates to the frontend code if any changes to the app listener
will be handled externally (by e.g. electron),
or whether the frontend code should attempt to repair the URL manually.
