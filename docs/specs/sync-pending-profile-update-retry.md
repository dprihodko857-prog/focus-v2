# Sync Pending Profile Update Retry

Status: IMPLEMENTED_LOCAL

## Problem

When the sync account profile is saved while the server is unavailable, the device name is stored locally, but the account display name can be lost and never retried.

## Goal

Queue failed sync account profile updates and retry them automatically when the app starts or the browser returns online.

## Scope

- Store the pending account profile update for the current sync account.
- Preserve both account display name and device name after an offline save.
- Retry the pending `PATCH /api/sync/account` on startup and online recovery.
- Clear the pending update after a successful save or if the account is no longer found.
- Clear the pending profile update when the local sync account is disconnected.
- Bump the PWA service worker cache for the changed app shell.

## Acceptance Criteria

- Offline profile save returns the typed display name and device name to the UI.
- Offline profile save writes a pending profile update.
- Successful retry sends the saved display name and device name to the backend.
- Successful retry clears the pending profile update.
- Startup and online recovery both trigger retry.
- Existing sync and install-quality tests pass.

## Out Of Scope

- Multi-account profile queues.
- Conflict resolution between devices editing the profile at the same time.
- Account deletion.
- Deployment, git push, tags, or production release.
