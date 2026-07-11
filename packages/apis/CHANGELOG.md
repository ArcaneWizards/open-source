# @arcanewizards/apis

## 0.0.2

### Patch Changes

- 19c0ae4: Add EULA fetching to API
- a928575: Introduce new structured release notes

  Introduce the `API_CONTENT` `zod` definition,
  and use it to define structured release notes in the update endpoints,
  deprecating the old markdown text endpoints.

- 19c0ae4: Add new required updateId parameter to CHECK_FOR_UPDATES_REQUEST
