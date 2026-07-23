# SYNC-DISCONNECT-001 - Current Device Sync Disconnect

Status: IMPLEMENTED_LOCAL_COMMITTED

## Owner Decision

The owner asked to continue project work on 2026-07-23 after TASK-016. Earlier owner direction allowed autonomous continuation through bounded local tasks. Production deployment and git push remain separate explicit gates.

## Goal

Let the user disconnect the current device from a code-based sync account without deleting local schedules, reminders, today tasks, notes, birthdays, or diary entries.

## In Scope

- Add an `Отключить` action in the sync account/device settings panel.
- Hide the action when there is no connected code-based sync account.
- Confirm before disconnecting.
- Use the existing sync client `clearAccountId()` method.
- Reset local per-collection sync diagnostics after disconnect.
- Keep local app data and the device id intact.
- Bump the service worker cache because `index.html`, `app.css`, and `app.js` are part of the PWA shell.
- Add contract tests for the UI and client behavior wiring.

## Out of Scope

- Backend account deletion.
- Removing a device record from the server profile.
- Orbit Auth logout changes.
- Local data deletion.
- Conflict-resolution UI.
- Production deployment.
- Git push, tags, or release work.

## Acceptance Criteria

- The sync modal includes a hidden-by-default disconnect button.
- The button becomes available for code-based sync accounts.
- Clicking the button asks for confirmation.
- Confirmed disconnect clears only the sync account id/revisions through the sync client.
- Local data is not removed.
- Per-collection sync status cards reset to idle.
- Existing sync, PWA, install, and layout tests pass.

## Required Checks

- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --test tests/sync-integration-assets.test.mjs tests/install-quality-css.test.mjs tests/desktop-layout-css.test.mjs`
- `npm.cmd run test`
- `git status --short`
- `git diff --stat`
