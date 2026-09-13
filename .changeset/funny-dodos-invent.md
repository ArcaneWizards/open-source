---
'@arcanewizards/clx': patch
---

[breaking] Send host & port in monitor

Rather than sending a host ID, always send the hostname and port in all events,
so that consumers can decide how they want to aggregate this data.
