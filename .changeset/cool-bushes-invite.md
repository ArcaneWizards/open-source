---
'@arcanewizards/clx': patch
---

Handle Pitch=0 for paused states

In Clockworks Server, Pitch is calculated automatically by the server and is not
always reported by the DJ software, as a result, when paused pitch will be 0.

This is in contrast to to when used with Gateway and CDJs,
where Pitch is always reported to be the value of the tempo slider,
even when paused.

As such we needed to add logic to account for a 0-valued Pitch,
and assume that the decks are paused when in this state.
