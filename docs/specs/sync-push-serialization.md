# SYNC-PUSH-SERIALIZATION-001 - Serialize Client Push Snapshots

Owner decision: autonomous continuation approved in chat on 2026-07-23.

## Goal

Serialize same-collection client push snapshots so an older in-flight push cannot complete after a newer push and overwrite newer server state.

## Context

- The app saves data locally first and pushes snapshots to the sync backend in the background.
- After TASK-008, background push calls are guarded from unexpected rejection.
- Push methods still sent concurrent same-collection `PUT` requests directly.
- If network timing reorders responses, an older snapshot can arrive after a newer one and become the latest remote state.

## In Scope For TASK-009

- Add a small per-collection push queue inside `public/js/sync.js`.
- Route `pushSchedules`, `pushReminders`, `pushTasks`, `pushNotes`, `pushBirthdays`, and `pushDiaryEntries` through that queue.
- Keep existing response shapes unchanged.
- Keep explicit `sync...` methods unchanged.
- Bump the service worker cache because `sync.js` is part of the app shell.
- Add a focused client test for concurrent schedule pushes.

## Out Of Scope

- Backend conflict resolution changes.
- Persistent retry queue.
- Cross-device merge algorithm.
- Changing explicit `sync...` pull/push behavior.
- Production deployment, git push, tags, or release work.

## Acceptance Criteria

- Same-collection background push calls execute in order.
- A later same-collection snapshot cannot be overwritten by an earlier in-flight push.
- Existing offline fallback responses remain unchanged.
- Existing revision storage behavior remains unchanged.
- Existing tests pass.

## Required Checks

- `node --check public/js/sync.js`
- `node --check public/service-worker.js`
- `node --test tests/focus-sync-client.test.mjs tests/sync-integration-assets.test.mjs tests/install-quality-css.test.mjs`
- `npm.cmd run test`
- `git status --short`
- `git diff --stat`
