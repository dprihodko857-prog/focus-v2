# Orbit Auth Account Switch Device Cleanup

Status: APPROVED_FOR_TASK_028

## Context

Orbit Auth can replace the local sync account id when an authenticated Orbit session is loaded. If the device was previously attached to another sync account code, that previous account could retain the current device session and local browser push subscription.

## Goal

Use the same previous-account cleanup path for Orbit Auth account switching that is already used for manual sync-code account switching.

## Requirements

- When an authenticated Orbit session has an account id that differs from the current local sync account, clean up the previous current device before saving the Orbit account id.
- Attempt local browser push unsubscribe before the new account registers push again.
- Preserve same-account refresh behavior.
- Preserve pending device disconnect retry behavior when cleanup cannot reach the server.
- Keep backend APIs unchanged.
- Bump the service worker cache for the changed PWA shell.

## Out Of Scope

- Orbit Auth server changes.
- Account deletion.
- Browser notification permission reset.
- Push provider changes.
- Production deploy, git push, tags, or release work.

## Acceptance

- `refreshAuthSession` calls the shared previous-account cleanup before `scheduleSync.setAccountId(authSession.accountId)`.
- Manual sync-code switching and Orbit Auth switching share the same cleanup helper.
- Focused contract tests cover both entry points.
- Existing tests pass locally.
