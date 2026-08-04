# Personal Schedule Import Validation Guard

## Status

IMPLEMENTED_LOCAL_COMMITTED

## Task

TASK-102 hardens Personal Schedule Planner import confirmation against invalid drafts.

## Scope

- Pass current Focus fixed intervals into `createPersonalScheduleImportBatch()`.
- Reuse the same draft validation for the draft screen, confirmation screen, and final import action.
- Disable the "Add to Focus" transition while the selected variant has blocking conflicts.
- Show user-readable Russian validation messages instead of raw conflict codes.
- Normalize weekday labels when checking generated blocks against existing fixed intervals.
- Bump the PWA cache to `focus-pwa-v122`.

## Acceptance

- A selected variant that overlaps an existing fixed Focus interval cannot produce an import batch.
- A fixed conflict is detected when the generated block weekday is a Russian weekday label.
- The draft screen disables the import transition while validation is not OK.
- Validation messages explain fixed conflicts, generated overlaps, invalid times, and sleep minimum failures without exposing raw codes as primary UI.
- Static and planner tests cover the guard.
- Focused and full regression checks pass locally.

## Out Of Scope

- Live AI provider credentials or provider routing.
- Planner layout redesign.
- Conflict auto-resolution.
- Backend API contract changes.
- Production deployment, git push, tags, or release work.
