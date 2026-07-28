# Push State Prune On Reminder Save

Status: IMPLEMENTED_LOCAL_COMMITTED

Implementation note: TASK-033 implemented and committed locally on 2026-07-28; deployment remains postponed by owner.

## Context

The backend stores push delivery, retry, and failure state by reminder delivery key. If a reminder is deleted or rescheduled, the old delivery key can remain in the JSON database even though the active reminder list no longer contains it.

## Goal

Keep reminder push state aligned with the current reminder snapshot for the account.

## Requirements

- When a reminder snapshot is saved, keep push delivery/retry/failure entries only for delivery keys still present in the saved reminder list.
- Preserve existing delivered reminder state for stale client pushes that still contain the same delivery key.
- Do not remove push event history; it remains an audit trail.
- Keep schedule/task/note/birthday/diary sync behavior unchanged.
- Add a focused server test for pruning removed reminder push state.

## Out Of Scope

- Push event history retention changes.
- Notification retry policy changes.
- Reminder model redesign.
- UI changes.
- Production deploy, git push, tags, or release work.

## Acceptance

- Saving a reminder snapshot with a removed reminder deletes stale delivery/retry/failure state for that removed delivery key.
- Active reminder delivery/retry/failure state remains available.
- Existing stale-client delivered reminder preservation still works.
- Existing tests pass locally.
