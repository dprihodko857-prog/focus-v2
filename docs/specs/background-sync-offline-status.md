# BACKGROUND-SYNC-OFFLINE-STATUS-001 - Surface Background Sync Offline State

Owner decision: autonomous continuation approved in chat on 2026-07-23.

## Goal

Show the user a clear local-save sync status when a background sync push returns the expected `offline` result.

## Context

- The sync client returns `{ status: "offline" }` for expected network failures instead of throwing.
- TASK-008 guarded fire-and-forget background sync pushes from unexpected rejection.
- The guard still did not surface expected offline results, so a local save could appear silent when the remote push was deferred.
- The app should keep local-first behavior but make deferred sync visible.

## In Scope For TASK-010

- Update `runBackgroundSync` in `app.js` to inspect resolved sync results.
- Show the existing local-save/offline sync status when a background push resolves with `status: "offline"`.
- Keep rejection handling from TASK-008.
- Keep local IndexedDB save behavior unchanged.
- Bump the service worker cache because `app.js` is part of the app shell.
- Update contract tests.

## Out Of Scope

- New persistent sync queue.
- Backend sync API changes.
- Account/auth changes.
- Conflict resolution changes.
- Production deployment, git push, tags, or release work.

## Acceptance Criteria

- Background sync rejection is still caught.
- Background sync `offline` results show the deferred sync status.
- Background push call sites remain routed through `runBackgroundSync`.
- Existing tests pass.

## Required Checks

- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --test tests/sync-integration-assets.test.mjs tests/install-quality-css.test.mjs`
- `npm.cmd run test`
- `git status --short`
- `git diff --stat`
