---
'@arcanewizards/sigil': patch
---

Expand user-actions module with more utilities

- `ActionResponse` type, designed to allow for more rich error messages from
  e.g. server actions
- `mapUserActionState` (basic functional map function over `UserActionState`)
- `useUserAction` - a react hook for managing state relating to user actions
  and promise-based calls
