---
'@arcanewizards/clx': patch
---

Only consider a deck playing after receiving proper packets

Until we receive packets that are advancing at roughly the same speed as
indicated by the pitch value, dont' consider a deck as being in the played state

This will mean when seeking or scratching, a deck will be in a stopped state,
and no flywheel behaviour will be observed.
