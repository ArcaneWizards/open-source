---
'@arcanewizards/sigil': patch
---

Prefer loopback (internal) interface in AppListenerManager

When multiple application listeners are available,
prefer the connection that's bound to an internal / loopback interface.
