# IndexedDB Reminders Legacy Cleanup

Status: IMPLEMENTED_LOCAL_COMMITTED

## Context

The app already stores reminders through the IndexedDB-backed storage module, but initial reminder hydration still loads IndexedDB directly and only falls back to `localStorage` when IndexedDB fails. That means an existing legacy `localReminders` value can remain in `localStorage` after the user has successfully moved to IndexedDB.

Reminders are important app data and should follow the same migration/cleanup path as schedules, tasks, notes, birthdays, and diary entries.

## Goal

Migrate legacy reminder data from `localStorage` into IndexedDB and remove stale reminder legacy data after successful IndexedDB access.

## Requirements

- Add a storage migration helper for reminders.
- If IndexedDB already has reminders, remove the stale `localReminders` legacy key.
- If IndexedDB has no reminders and legacy `localReminders` has a valid list, save it into IndexedDB and remove the legacy key.
- Keep existing fallback behavior when IndexedDB is unavailable.
- Bump the service worker cache because `app.js` and `storage.js` are part of the PWA shell.
- Add focused storage and integration tests.

## Out Of Scope

- Changing reminder data shape.
- Changing reminder scheduling or push delivery behavior.
- Removing the fallback write path when IndexedDB is unavailable.
- Production deploy, git push, tags, or release work.

## Implementation

- `scheduleStorage.migrateRemindersFromLocalStorage()` now loads existing IndexedDB reminders first.
- If IndexedDB already has reminders, stale legacy `localReminders` data is removed.
- If IndexedDB is empty and legacy `localReminders` contains a valid list, reminders are saved into IndexedDB and the legacy key is removed.
- App startup reminder hydration uses the migration helper while keeping the existing fallback path for IndexedDB failures.
- The service worker cache was bumped to `focus-pwa-v70`.

## Acceptance

- Legacy reminder data migrates into IndexedDB.
- Stale legacy reminder data is removed when IndexedDB already has reminder data.
- Reminder hydration uses the migration helper.
- Existing tests pass locally.
