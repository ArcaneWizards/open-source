---
'@arcanewizards/sigil': patch
---

Pull out styling hooks into own module

To allow for the core styling module to be used in server components,
pull out the hooks into their own module,
so that useEffect will not be imported unless required.
