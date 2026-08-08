---
'@arcanewizards/timecode-toolbox': patch
---

Fix occasional MacOS MIDI crashing

CoreMIDI can sometimes return with response code -304 when attempting to
initialize a client to listen for changes to the MIDI devices.
Timecode Toolbox now handles this by falling-back to polling mode if this error
is encountered. It is usually temporary, and future attempts to establish
listeners (e.g. after the app is restarted) usually works.
