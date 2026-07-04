---
'@arcanewizards/tcnet': patch
---

Stop printing warnings for supplied trackId

Newer versions of ShowKontrol are correctly supplying trackId information
within METADATA packets,
so when they are provided, they can be used directly instead of weighting the
responses based on which track IDs we think are loaded.
