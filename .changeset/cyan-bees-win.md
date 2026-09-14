---
'@arcanewizards/sigil': minor
---

[breaking] Improve efficiency of internal log handling

Switch from using Array to FiFo for log storage,
which allows for O(1) log appending and retrieval.

This also decreases the limit for the default number of entries to 100.

As part of this, breaking changes have been made to the API,
however if the default App-Shell is being used directly,
it should not require any code changes.
