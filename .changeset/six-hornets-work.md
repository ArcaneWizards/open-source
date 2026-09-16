---
'@arcanewizards/clx': patch
---

Fire a `deck-disconnected` for every known deck when server disconnects

A monitor client may not make use of host / server information in the same way
as decks (for example, it may only care about connected decks).
As such, to make cleanup easier,
send a `deck-disconnected` event for every known deck, and every deck that will
have had a `timecode-changed` event fired,
before sending the `server-disconnected` event.
