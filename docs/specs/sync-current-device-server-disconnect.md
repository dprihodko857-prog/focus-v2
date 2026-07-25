# Sync Current Device Server Disconnect

Status: IMPLEMENTED_LOCAL

## Problem

The Settings disconnect action cleared the sync account only on the current device. The backend still kept this device in the account device list and kept its push subscriptions, so old devices could remain visible and receive future server-side state checks.

## Goal

When a code-based sync device is disconnected, remove the current device session and push subscriptions from the server before clearing the local sync account.

## Scope

- Add a backend endpoint for current-device disconnect.
- Remove only the current device session and push subscriptions for the current device.
- Keep account data, schedules, reminders, tasks, notes, birthdays, diary entries, and other devices intact.
- Keep local disconnect reliable when the server is unavailable.
- Do not allow the client disconnect helper to create a new sync account when no local account exists.
- Bump the PWA service worker cache for the changed app shell.

## Acceptance Criteria

- `DELETE /api/sync/devices/current` rejects missing or unknown accounts using the existing account validation behavior.
- `DELETE /api/sync/devices/current` removes the current device session.
- The endpoint removes push subscriptions for the current device only.
- The Settings disconnect flow attempts server cleanup before local `clearAccountId()`.
- Local disconnect still completes if server cleanup fails or the account is already missing.
- Existing sync, push, install, and layout tests pass.

## Out Of Scope

- Account deletion.
- Removing other devices.
- Remote logout for Orbit Auth sessions.
- Push unsubscribe from the browser PushManager.
- Deployment, git push, tags, or production release.
