---
'@arcanewizards/midi': patch
---

Introduce multi-arch MacOS build to allow for cross-compiled apps

Previously this package would only build native modules in the same architecture
as the host machine. This meant that cross-compiled electron apps
(e.g. timecode toolbox x64 built on arm64) would not have the appropriate
native code available for use.

This change now ensures that both arm64 and x64 architectures are built when
installed on MacOS, allowing for cross-compiled electron apps to be loaded
properly.
