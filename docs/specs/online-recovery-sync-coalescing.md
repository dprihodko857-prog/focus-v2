# ONLINE-RECOVERY-SYNC-COALESCING-001 - Coalesce Online Recovery Sync

Owner decision: autonomous continuation approved in chat on 2026-07-23.

## Goal

Prevent duplicate online recovery sync batches when the browser fires repeated `online` events.

## Context

- The app already retries data sync and push registration when the device comes back online.
- Network transitions can fire multiple `online` events in a short window.
- Before this task, each event started a new batch of schedule, task, note, birthday, diary, reminder, and push-status requests.
- A single in-flight recovery pass is enough; repeated events can reuse it until it finishes.

## In Scope For TASK-012

- Add a small `runOnlineRecoverySync` helper in `app.js`.
- Coalesce repeated `online` events into one in-flight recovery pass.
- Keep the existing recovery operations unchanged.
- Keep failures isolated through `Promise.allSettled`.
- Bump the service worker cache because `app.js` is part of the app shell.
- Add/update contract tests.

## Out Of Scope

- Backend sync API changes.
- Persistent offline mutation queue.
- Conflict resolution changes.
- Push delivery policy changes.
- Production deployment, git push, tags, or release work.

## Acceptance Criteria

- Repeated `online` events reuse the current recovery promise while it is pending.
- Recovery still runs schedules, tasks, notes, birthdays, diary entries, reminders, push registration, and push status refresh.
- One failed recovery operation does not block the rest.
- The in-flight marker is cleared after the recovery pass finishes.
- Existing tests pass.

## Required Checks

- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --test tests/sync-integration-assets.test.mjs tests/install-quality-css.test.mjs`
- `npm.cmd run test`
- `git status --short`
- `git diff --stat`
