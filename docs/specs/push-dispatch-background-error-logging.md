# Push Dispatch Background Error Logging

Status: IMPLEMENTED_LOCAL_COMMITTED

Implementation note: TASK-040 implemented and committed locally on 2026-07-29; deployment remains a separate owner gate.

## Context

The sync backend periodically runs reminder push dispatch from a background interval. Expected per-subscription delivery failures are handled inside the dispatcher, but an unexpected dispatcher-level failure is currently swallowed by an empty `catch`.

That can hide production problems in the systemd journal and make notification reliability issues harder to diagnose.

## Goal

Log unexpected background reminder dispatch failures without changing public API behavior.

## Requirements

- Background reminder dispatch failures are reported to a logger.
- The background interval must not create unhandled promise rejections.
- Logger failures must not crash the backend.
- Existing `dispatchDueReminders` behavior and return shape remain unchanged.
- Add focused server tests for the safe background dispatch wrapper.

## Out Of Scope

- Changing retry policy.
- Changing push payloads or provider behavior.
- Adding external logging infrastructure.
- Client UI changes.
- Production deploy, git push, tags, or release work.

## Acceptance

- Unexpected dispatcher failures are passed to `logger.error`.
- A throwing logger does not rethrow from the background dispatch wrapper.
- Existing tests pass locally.
