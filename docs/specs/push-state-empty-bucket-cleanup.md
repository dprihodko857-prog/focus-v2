# Push State Empty Bucket Cleanup

Status: IMPLEMENTED_LOCAL_COMMITTED

Implementation note: TASK-041 implemented and committed locally on 2026-07-29; deployment remains a separate owner gate.

## Context

Reminder push delivery state is stored by account in `pushDeliveries`, `pushRetries`, and `pushFailures`. Bulk pruning already removes empty account buckets, but direct state transitions such as retry cleanup, retry to delivered, or retry to failure can leave an empty account object behind.

This does not change notification delivery, but it makes the JSON database noisier over time.

## Goal

Delete empty push state account buckets after direct per-delivery state cleanup.

## Requirements

- Remove an empty retry bucket after `clearPushRetry`.
- Remove an empty retry bucket when a retry is replaced by delivery state.
- Remove an empty failure bucket when a failure is replaced by delivery state.
- Remove an empty retry bucket when a retry is replaced by terminal failure state.
- Keep existing delivery, retry, and failure response behavior unchanged.
- Add focused server tests for empty bucket cleanup.

## Out Of Scope

- Changing push retry policy.
- Changing delivery/failure event history.
- Changing reminder snapshot pruning.
- Client UI changes.
- Production deploy, git push, tags, or release work.

## Acceptance

- Direct retry cleanup removes the empty account retry bucket.
- Successful delivery cleanup removes empty retry and failure buckets for that account.
- Terminal failure cleanup removes the empty retry bucket for that account.
- Existing tests pass locally.
