---
'@arcanewizards/ltc': patch
'@arcanewizards/timecode-toolbox': patch
---

Avoid splicing the LTC writer output on small timeline adjustments

Play state updates that shift the timeline by up to 10ms (such as clock-sync
jitter between the browser and server) are now slewed in gradually instead of
jumping the waveform mid-frame. Previously each adjustment produced a frame with
the wrong number of bits, which LTC readers would drop or misread as an
unrelated timecode.
