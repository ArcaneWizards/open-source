---
'@arcanewizards/timecode-toolbox': patch
---

Add more config metadata to timecodes UI

- ArtNet & TCNet Inputs now display interface name & IP address
- ArtNet Outputs now display interface name & IP address, or hostname
- MIDI Inputs & Outputs now display device type (virtual vs physical)
  and device name
- System clock generators now show timezone when it's different to
  system clock

All this information is displayed at the top of the timecode alongside
the name. If a name is set, that will be shown first (to the left),
with the metadata shown after. If no name is set,
the metadata is shown to the left of the placeholder.
