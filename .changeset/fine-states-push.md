---
'@arcanewizards/timecode-toolbox': patch
---

Keep player running when settings/debugger/info opened

Previously, when opening any of the other app windows while music was playing,
the music would stop without any warning. Now it continues playing in the
background.

fixes 82
