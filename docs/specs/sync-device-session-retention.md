# Sync Device Session Retention

Status: IMPLEMENTED_LOCAL_COMMITTED

Implementation note: TASK-036 implemented and committed locally on 2026-07-28; deployment remains postponed by owner.

## Context

The sync backend tracks device sessions for each account so the Settings profile can show connected devices. A PWA reinstall, browser reset, or account reconnect can create new device ids over time, which can make the JSON database and profile list grow without a limit.

## Goal

Keep only a bounded recent history of device sessions per account.

## Requirements

- Retain the most recently active device sessions for an account.
- Keep the currently touched or updated device session even when pruning older sessions.
- Keep existing account profile response shape unchanged.
- Do not delete push subscriptions as part of this retention pass.
- Add a focused server test for device session retention.

## Out Of Scope

- Device management UI changes.
- Push subscription deletion policy changes.
- Account deletion.
- Database engine migration.
- Production deploy, git push, tags, or release work.

## Acceptance

- More than the configured retention limit of device sessions is pruned to the most recent sessions.
- Older sessions are removed from account profile output.
- The current device remains visible and marked as current.
- Existing tests pass locally.
