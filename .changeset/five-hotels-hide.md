---
'@arcanewizards/tcnet': patch
---

Fix weighting metadata calculation with definitive trackId

There was a bug with the logic for determining correct metadata when trackID
is supplied by TCNet server (e.g. ShowKontrol).

Furthermore, there's a bug in ShowKontrol where old metadata will be returned
with the new trackId, so added some comments around how we can't rely on that
alone.
