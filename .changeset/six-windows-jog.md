---
'@arcanewizards/sigil': patch
---

Refactor close confirmation API

Make it possible for electron apps to block closing windows properly by
listening to the `close` event,
by introducing a new API for registering window close confirmation behavior.
