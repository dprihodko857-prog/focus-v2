# BACKGROUND-SYNC-GUARD-001 - Guard Fire-And-Forget Sync Pushes

Owner decision: autonomous continuation approved in chat on 2026-07-23.

## Goal

Guard client-side background sync push calls so local saves stay stable even if a future sync path throws unexpectedly.

## Context

- The app saves important data locally first, then starts remote sync pushes in the background.
- The sync client normally returns `offline` for expected network failures.
- Several UI save paths called `scheduleSync.push...` directly without a central guard.
- A single guard gives the app one place to handle unexpected background sync rejection and later attach a retry queue if needed.

## In Scope For TASK-008

- Add a small `runBackgroundSync` helper in `app.js`.
- Route fire-and-forget `scheduleSync.push...` calls through the helper.
- Keep local save behavior unchanged.
- Keep explicit user-triggered sync flows unchanged.
- Bump the service worker cache because `app.js` is part of the app shell.
- Add/update contract tests.

## Out Of Scope

- New persistent sync queue.
- Backend sync API changes.
- Account/auth changes.
- Conflict resolution changes.
- Production deployment, git push, tags, or release work.

## Acceptance Criteria

- Background push calls for schedules, reminders, tasks, notes, birthdays, and diary entries go through `runBackgroundSync`.
- Unexpected background sync rejection is caught.
- Local IndexedDB save flow is unchanged.
- Existing explicit sync methods remain awaitable and visible in the sync UI.
- Existing tests pass.

## Required Checks

- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --test tests/sync-integration-assets.test.mjs tests/install-quality-css.test.mjs`
- `npm.cmd run test`
- `git status --short`
- `git diff --stat`
