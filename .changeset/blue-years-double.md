---
'@arcanewizards/timecode-toolbox': patch
---

Fix requesting local network access for ArtNet and TCNet.

Starting from MacOS 15 Sequoia, apps that require local network access need to
provide a description as to why they need it. WIthout this, only apps that had
previously been allowed through would work, and otherwise they would silently
fail. A description is now provided for Timecode Toolbox.
