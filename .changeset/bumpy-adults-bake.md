---
'@arcanewizards/sigil': patch
---

Fix media session in browser windows

Fix a bug where `createBrowserMediaSession()` was called multiple times,
leading to apps being unable to register handlers correctly when run
in the browser.
