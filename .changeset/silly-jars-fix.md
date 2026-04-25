---
'@arcanewizards/timecode-toolbox': patch
---

Fix Art-Net Drift

The previous implementation of our artnet timecode broadcast would regularly be
out by about 1 frame, due to us not timing sending of the packets appropriately,
and rounding down to the nearest frame when converting millisecond timecodes
to frame timecodes.

We now schedule appropriate timeouts based on when the next frame starts.
