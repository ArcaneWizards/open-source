---
'@arcanewizards/timecode-toolbox': patch
---

Allow configuring for multiple sending hosts for CLX

Allow CLX inputs to be configured with different behavior when receiving messages
from multiple hosts, or from multiple source ports on the same machine.

Users can choose to either consider this a single timecode, and use the latest
value for all of them, or treat them as independent sources that can be
monitored or linked separately to outputs.
