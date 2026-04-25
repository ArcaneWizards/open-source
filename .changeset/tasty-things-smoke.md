---
'@arcanewizards/timecode-toolbox': patch
---

Address Art-Net output loop forking.

Maintaining a custom frame event loop using `setTimeout` caused previous
ArtNet states to continue sending even though they should have stopped.

This issue has now been addressed.

fixes #66
