---
'@arcanewizards/timecode-toolbox': patch
---

Required Action: Correct Application folder in Windows

On windows, Timecode Toolbox was incorrectly using the folder `ArcaneDesktop` to
install itself, which was incorrect and conflicting with our other application
that's currently in early-access.

This will probably mean that when you install this version, the existing version
will remain installed, which will require you to manually uninstall it yourself.
