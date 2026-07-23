# SYNC-DATA-STATUS-001 - Per-Collection Sync Status Panel

Status: IMPLEMENTED_LOCAL_COMMITTED

## Owner Decision

The owner asked to continue project work on 2026-07-23 after the Warm Glass contrast deployment. Earlier owner direction allowed autonomous continuation through bounded local tasks, while push and production deployment remain separate explicit gates.

## Goal

Add a compact Settings diagnostics panel that shows whether each important local collection is ready, syncing, waiting for retry, offline, failed, sent, or pulled from the sync backend.

## In Scope

- Add a `Состояние синхронизации` panel inside the sync/settings modal.
- Show one row per collection:
  - schedules
  - reminders
  - today tasks
  - notes
  - birthdays
  - diary entries
- Show local item counts and the latest known sync state.
- Track background push outcomes through the existing `runBackgroundSync` guard.
- Track manual and automatic full sync calls through the existing `syncSaved...` functions.
- Add a `Сверить` action that runs a full client sync pass and refreshes the account profile.
- Bump the service worker cache because `index.html`, `app.css`, and `app.js` are part of the PWA shell.
- Add contract tests for the panel and cache version.

## Out of Scope

- Backend API changes.
- Database schema changes.
- Auth model changes.
- New conflict-resolution UI.
- Production deployment.
- Git push, tags, or release work.

## Acceptance Criteria

- The sync modal exposes the diagnostics panel and manual refresh button.
- Each important collection has a visible status card.
- Fire-and-forget background pushes mark the affected collection as pending, sent, pulled, offline, or failed.
- Full sync helpers mark the affected collection as syncing and then update the result state.
- Manual refresh can sync all collections without requiring a page reload.
- Existing app behavior and layout remain intact.
- Required checks pass.

## Required Checks

- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --test tests/sync-integration-assets.test.mjs tests/install-quality-css.test.mjs tests/desktop-layout-css.test.mjs`
- `npm.cmd run test`
- `git status --short`
- `git diff --stat`
