# Sync Account Switch Profile Reset

Status: APPROVED_FOR_TASK_030

## Context

Manual sync-code account switching already cleans up the previous device and resets per-collection diagnostics. The account profile panel can still briefly show the previous account display name and device list until the new account profile request finishes.

## Goal

When switching to another sync account through a manual code, clear the stale local account profile immediately after storing the new account id and before requesting the new profile.

## Requirements

- Only clear the account profile when a real existing-account switch happened.
- Keep same-account reconnect behavior unchanged.
- Keep Orbit Auth profile clearing behavior unchanged.
- Render the empty/new account profile state before the async profile refresh finishes.
- Do not change persisted user data or backend APIs.
- Bump the service worker cache for the changed PWA shell.

## Out Of Scope

- Backend changes.
- Account deletion.
- Sync conflict policy changes.
- Visual redesign.
- Production deploy, git push, tags, or release work.

## Acceptance

- Manual sync-code switching sets `syncAccountProfile = null` after storing a different account id.
- Manual sync-code switching re-renders the profile panel before `refreshSyncAccountProfile`.
- Focused contract tests cover the stale profile reset.
- Existing tests pass locally.
