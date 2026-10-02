---
'@arcanewizards/timecode-toolbox': patch
---

Fix memory leak and other performance improvements

Prior to this version, we were incorrectly building with the dev version of
react-reconciler, both for the server and GUI,
meaning that over time the app would be taking performance measurements
and eventually reach 1M measurements and crash the UI or the main app.

We now build with the production version of react-reconciler,
meaning that these measurements are disabled,
and memory usage is substantially better in general.
