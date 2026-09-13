---
'@arcanewizards/clx': patch
---

Wait for minimum amount of time before considering deck paused

Rather than considering sequential deck messages with the same position as the
deck being in a paused state, wait for a minimum amount of time.
This previously worked well with Clockworks Gateway and Pioneer equipment,
but some integrations like Clockworks Server with Serato will send multiple
deck messages with the same position even if the playback is proceeding normally.
