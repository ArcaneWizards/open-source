---
'@arcanewizards/timecode-toolbox': patch
---

Allow configuring for multiple sending hosts for CLX

Allow both ArtNet and CLX inputs to be configured with different behaviour when
receiving messages from multiple hosts, or from multiple hosts on the same
machine.

Users can choose to either consider this a single timecode, and use the latest
value for all of them, or treat them as independent sources that can be
monitored or linked separately to outputs.
