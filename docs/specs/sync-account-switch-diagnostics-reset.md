# Sync Account Switch Diagnostics Reset

Status: APPROVED_FOR_TASK_029

## Context

Per-collection sync diagnostics are account-scoped from the user's point of view. After switching to another sync account, old `pushed`, `pulled`, or `offline` statuses could remain visible until the next sync pass updates them.

## Goal

When the app switches from one existing sync account to a different account, reset collection diagnostics before showing sync state for the new account.

## Requirements

- Reuse the existing account-switch cleanup path to detect a real account change.
- Reset collection diagnostics after storing the new account id when a real account change happened.
- Apply the reset to manual sync-code switching and Orbit Auth account switching.
- Do not reset diagnostics for same-account refreshes.
- Do not change persisted user data or backend APIs.
- Bump the service worker cache for the changed PWA shell.

## Out Of Scope

- Backend changes.
- Sync conflict policy changes.
- Push provider changes.
- Visual redesign.
- Production deploy, git push, tags, or release work.

## Acceptance

- The account-switch cleanup helper returns whether a real account change happened.
- Manual sync-code switching resets diagnostics only when that helper reports a change.
- Orbit Auth account switching resets diagnostics only when that helper reports a change.
- Focused contract tests cover the reset.
- Existing tests pass locally.
