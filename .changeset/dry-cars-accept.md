---
'@arcanewizards/artnet': patch
---

Return nextFrameTimeMillis when sending frames

Make it possible for clients to more accurately time sending of artnet packets
and avoid frame drift by returning information on when the next frame send
should be.
