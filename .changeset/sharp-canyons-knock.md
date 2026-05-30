---
'@arcanewizards/midi': patch
---

Ensure device changes update state

Ensure that when MIDI devices are hotplugged, or virtual devices are created or
removed, that the list of inputs and outputs will return an up-to-date view.
