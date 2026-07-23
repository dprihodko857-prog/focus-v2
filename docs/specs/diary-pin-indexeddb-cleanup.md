# DIARY-PIN-STORAGE-001 - IndexedDB PIN Cleanup

Owner decision: autonomous continuation approved in chat on 2026-07-23.

## Goal

Keep the private diary PIN settings in IndexedDB as the primary storage and remove stale `localStorage` fallback copies after successful IndexedDB reads or writes.

## Context

- The diary is protected by a four digit PIN gate.
- PIN settings are stored as derived settings (`salt`, `hash`, `iterations`, `updatedAt`), not as the raw PIN.
- The app previously kept `localStorage` as a fallback if IndexedDB was unavailable.
- If a user had an older fallback copy, it could remain in `localStorage` even after IndexedDB became available again.

## In Scope For TASK-005

- Migrate a valid legacy diary PIN fallback from `localStorage` into IndexedDB when IndexedDB has no PIN settings yet.
- Clear the legacy fallback after a successful IndexedDB PIN read or write.
- Preserve the existing fallback behavior when IndexedDB fails, so diary protection still works in the current session.
- Bump the service worker cache because `app.js` is part of the PWA shell.
- Add/update contract tests for the cleanup behavior.

## Out Of Scope

- Changing the PIN algorithm or iteration count.
- Adding biometric unlock.
- Server-side diary encryption.
- Backend sync changes.
- Production deployment, git push, tags, or release work.

## Acceptance Criteria

- Existing IndexedDB PIN settings continue to load normally.
- A valid legacy `localStorage` PIN fallback is copied into IndexedDB when IndexedDB has no PIN settings.
- The legacy `localStorage` PIN key is removed after successful IndexedDB migration.
- Saving or clearing the PIN through IndexedDB removes the legacy fallback key.
- If IndexedDB fails, the app can still read/write the fallback key.
- Existing diary unlock behavior remains unchanged.

## Required Checks

- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --test tests/sync-integration-assets.test.mjs`
- `npm.cmd run test`
- `git status --short`
- `git diff --stat`
