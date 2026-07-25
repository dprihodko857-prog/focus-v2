# Sync Pending Device Disconnect Retry

Status: IMPLEMENTED_LOCAL

## Problem

If the server is unavailable while a device is disconnected from sync, the app clears the local sync account but cannot remove the server-side device session and push subscriptions immediately. Without a retry queue, the cleanup can remain incomplete after the local account id is gone.

## Goal

Queue failed current-device server disconnect cleanup and retry it automatically on app startup and when the browser comes back online.

## Scope

- Store pending device disconnect cleanup with the old `accountId` and current `deviceId`.
- Retry `DELETE /api/sync/devices/current` without requiring the current local sync account to still exist.
- Clear the pending cleanup when the server confirms removal or reports the account is already missing.
- Keep local disconnect behavior unchanged: local data remains and the local sync account is cleared.
- Bump the PWA service worker cache for the changed app shell.

## Acceptance Criteria

- Failed current-device disconnect queues the previous `accountId` and `deviceId`.
- Clearing the local account does not delete the pending server cleanup.
- Pending cleanup is retried on app startup.
- Pending cleanup is retried during online recovery sync.
- Successful retry clears the pending queue.
- Existing sync and install-quality tests pass.

## Out Of Scope

- Account deletion.
- Removing other devices.
- Background Sync API registration.
- PushManager unsubscribe.
- Deployment, git push, tags, or production release.
