# Sync Account Switch Device Cleanup

Status: APPROVED_FOR_TASK_027

## Context

When a device switches from one sync account code to another, the previous account can still retain the current device session and browser push subscription. Code-based disconnect and Orbit logout already clean up this state, but direct account switching should use the same cleanup path before storing the new account id.

## Goal

Before saving a different sync account id, remove the current device from the previous server account and unsubscribe the local browser push subscription. Then continue the existing connection flow for the new account and register push for the new account.

## Requirements

- Validate the target sync account before changing local account state.
- If the current local account differs from the validated target account, attempt current-device server cleanup for the previous account.
- If the current local account differs from the validated target account, attempt local browser push unsubscribe before registering push for the new account.
- Preserve the existing pending device disconnect retry queue for offline cleanup.
- Keep same-account reconnect behavior unchanged.
- Bump the service worker cache for the changed PWA shell.

## Out Of Scope

- Account deletion.
- Orbit Auth server changes.
- Browser notification permission reset.
- Push provider changes.
- Production deploy, git push, tags, or release work.

## Acceptance

- `connectSyncAccount` compares the existing account id with the validated target account id.
- Account switch cleanup runs before `scheduleSync.setAccountId(nextAccountId)`.
- Existing sync pulls and push registration for the new account still run after account switching.
- Focused contract tests cover the cleanup order.
- Existing tests pass locally.
