# SYNC-STATE-MEMORY-FALLBACK-001 - Keep Sync State Stable Without LocalStorage

Owner decision: autonomous continuation approved in chat on 2026-07-23.

## Goal

Keep sync account, device, and revision state stable inside the current app session when `localStorage` is unavailable.

## Context

- Important user data is stored through IndexedDB-backed storage.
- The sync client still uses `localStorage` for small sync metadata: account id, device id, device name, and revision numbers.
- Some installed/mobile browser contexts can temporarily block or fail Web Storage access.
- Without a fallback, one session can generate repeated device ids or accounts when storage calls fail.

## In Scope For TASK-011

- Add an in-memory fallback store inside `public/js/sync.js`.
- Use the fallback only for sync metadata within the current client instance.
- Keep normal `localStorage` behavior unchanged when storage is available.
- Keep IndexedDB data storage unchanged.
- Bump the service worker cache because `sync.js` is part of the app shell.
- Add a focused sync-client test.

## Out Of Scope

- Moving sync metadata to IndexedDB.
- Backend sync API changes.
- Account merge or device merge logic.
- Cross-session persistence when browser storage is unavailable.
- Production deployment, git push, tags, or release work.

## Acceptance Criteria

- Device id stays stable within one client session when `localStorage` throws.
- Device name stays stable within one client session when `localStorage` throws.
- Account id creation is not repeated within one client session after successful account creation.
- `setAccountId` and `clearAccountId` work against the fallback store.
- Existing tests pass.

## Required Checks

- `node --check public/js/sync.js`
- `node --check public/service-worker.js`
- `node --test tests/focus-sync-client.test.mjs tests/sync-integration-assets.test.mjs tests/install-quality-css.test.mjs`
- `npm.cmd run test`
- `git status --short`
- `git diff --stat`
