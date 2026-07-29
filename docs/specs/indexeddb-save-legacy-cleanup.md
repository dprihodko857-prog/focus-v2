# INDEXEDDB-SAVE-LEGACY-CLEANUP-001 - Remove Legacy Keys After IndexedDB Saves

Status: IMPLEMENTED_LOCAL_COMMITTED

## Context

Important app data is stored in IndexedDB with a `localStorage` fallback for cases where IndexedDB is unavailable. Previous cleanup tasks removed stale legacy data during startup migration, but successful save calls could still leave an old fallback copy if that copy was created during an earlier temporary IndexedDB failure in the same browser session.

## Goal

Remove stale fallback `localStorage` keys immediately after successful IndexedDB saves for important app data.

## Requirements

- Remove the schedules legacy key after a successful IndexedDB schedule save.
- Remove the reminders fallback key after a successful IndexedDB reminder save.
- Remove tasks, notes, birthdays, diary, and diary PIN fallback keys after successful IndexedDB saves.
- Keep fallback writes unchanged when IndexedDB is unavailable.
- Bump the service worker cache because `storage.js` is part of the PWA shell.
- Add focused storage coverage for save-time cleanup.

## Out Of Scope

- Changing data shapes.
- Changing sync, reminders, push delivery, or diary PIN behavior.
- Removing fallback writes when IndexedDB is unavailable.
- Production deploy, git push, tags, or release work.

## Implementation

- `saveSchedules`, `saveReminders`, `saveTasks`, `saveNotes`, `saveBirthdays`, `saveDiaryEntries`, and `saveDiaryPinSettings` now remove their matching fallback keys only after `putValue` succeeds.
- The service worker cache was bumped to `focus-pwa-v71`.

## Acceptance

- Successful IndexedDB saves remove stale fallback keys for all important local data collections.
- IndexedDB failure paths still leave fallback behavior available.
- Existing tests pass locally.
