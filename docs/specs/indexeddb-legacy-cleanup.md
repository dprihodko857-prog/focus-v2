# INDEXEDDB-LEGACY-CLEANUP-001 - Remove Migrated Legacy Keys

Owner decision: autonomous continuation approved in chat on 2026-07-23.

## Goal

Remove stale legacy `localStorage` keys for important app data after the data has been successfully loaded from or migrated into IndexedDB.

## Context

- Schedules, tasks, notes, birthdays, and diary entries are IndexedDB-backed.
- Legacy `localStorage` keys still existed as a migration/fallback source.
- Before this task, successful migration copied data into IndexedDB but left the old keys in place.
- Keeping stale legacy keys can cause privacy confusion and makes it harder to reason about the primary data source.

## In Scope For TASK-006

- Remove the legacy key after a successful migration write into IndexedDB.
- Remove a stale legacy key when IndexedDB already has primary data.
- Keep fallback reads in `app.js` unchanged for cases where IndexedDB fails.
- Bump the service worker cache because `storage.js` is part of the app shell.
- Add focused storage tests for cleanup behavior.

## Out Of Scope

- Data model changes.
- Backend sync changes.
- Account/auth changes.
- Removing fallback writes when IndexedDB is unavailable.
- Production deployment, git push, tags, or release work.

## Acceptance Criteria

- Migrating schedules removes `LEGACY_SCHEDULES_KEY` after successful IndexedDB save.
- Migrating tasks removes `LEGACY_TASKS_KEY` after successful IndexedDB save.
- Migrating notes removes `LEGACY_NOTES_KEY` after successful IndexedDB save.
- Migrating birthdays removes `LEGACY_BIRTHDAYS_KEY` after successful IndexedDB save.
- Migrating diary entries removes `LEGACY_DIARY_KEY` after successful IndexedDB save.
- If IndexedDB already has primary schedules, stale legacy schedules are removed and IndexedDB data wins.
- Existing fallback behavior remains available if IndexedDB fails.

## Required Checks

- `node --check public/js/storage.js`
- `node --check public/service-worker.js`
- `node --test tests/focus-storage.test.mjs`
- `npm.cmd run test`
- `git status --short`
- `git diff --stat`
