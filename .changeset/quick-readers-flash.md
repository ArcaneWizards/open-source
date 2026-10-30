---
'@arcanewizards/midi-timecode': minor
---

[breaking] - remove mode and require it to be set when changing state

For more consistency with the `@arcanewizards/smpte` API,
and to avoid bust like https://github.com/ArcaneWizards/open-source/issues/119 -
the SMPTE mode is now always taken from the `SMPTETimecodePlayState`
passed in to `setPlayState`.

Also fixes https://github.com/ArcaneWizards/open-source/issues/119
