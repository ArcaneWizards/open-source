---
'@arcanewizards/timecode-toolbox': patch
---

Ensure that SMPTE mode is sent with stopped frames in MTC

Make sure that the configured SMPTE mode is used when sending stopped timecode
frames over MTC.

Fixes https://github.com/ArcaneWizards/open-source/issues/119
