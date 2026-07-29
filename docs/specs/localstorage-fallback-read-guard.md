# LOCALSTORAGE-FALLBACK-READ-GUARD-001 - Guard Legacy Fallback Reads

Status: IMPLEMENTED_LOCAL_COMMITTED

## Context

The app keeps `localStorage` fallback paths for rare cases where IndexedDB is unavailable. Most legacy collection reads were already wrapped, but reminder hydration still read `localStorage` directly inside an IndexedDB failure path. If browser storage access itself throws, the fallback path can fail instead of returning an empty safe state.

## Goal

Centralize and guard legacy fallback reads so unavailable `localStorage` cannot break app hydration.

## Requirements

- Add one safe helper for reading `localStorage` items.
- Route legacy list reads through one helper that returns an empty list for missing, invalid, or unavailable storage.
- Use the helper for reminder fallback hydration.
- Use the helper for diary PIN fallback parsing.
- Keep fallback writes unchanged.
- Bump the service worker cache because `app.js` is part of the PWA shell.
- Add a focused integration asset contract test.

## Out Of Scope

- Changing data shapes.
- Changing IndexedDB, sync, notification, or diary PIN behavior.
- Removing fallback writes when IndexedDB is unavailable.
- Production deploy, git push, tags, or release work.

## Implementation

- Added `readLocalStorageItem(key)` and `readLegacyScheduleList(key)` in `app.js`.
- Legacy schedule/task/note/birthday/diary/reminder reads now route through the guarded helper.
- Diary PIN fallback parsing now uses the guarded storage read helper.
- The service worker cache was bumped to `focus-pwa-v72`.

## Acceptance

- Legacy fallback list reads do not throw when `localStorage` access fails.
- Reminder hydration uses the guarded fallback list helper.
- Existing tests pass locally.
