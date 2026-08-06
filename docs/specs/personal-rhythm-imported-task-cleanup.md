# Personal Rhythm Imported Task Cleanup

Status: IMPLEMENTED_LOCAL_PENDING_COMMIT

Task: TASK-115

## Problem

Older Personal Rhythm imports could create one Focus task per generated block. If the task import option was enabled before TASK-113, the main "today tasks" surface could become filled with generic block tasks, making the result hard to understand.

## Scope

- Add a manual cleanup action inside the Personal Rhythm history screen when imported Personal Rhythm tasks are detectable.
- Remove only tasks created by Personal Rhythm imports.
- Preserve imported schedules, imported reminders, and user-created tasks.
- Preserve Personal Rhythm source metadata during generic task normalization so future cleanup remains possible after storage round-trips.
- Keep the work local only. Do not deploy to the server.

## Behavior

The cleanup can identify removable tasks in two safe ways:

- task ids recorded in applied Personal Rhythm import batches
- tasks that carry both `source: "personal_schedule_planner"` and a `personalScheduleBlockId`

After cleanup, matching task ids are removed from the task collection and marked as cleaned inside the corresponding import batch metadata. The import history remains available for schedules and reminders.

## Acceptance Criteria

- The Personal Rhythm history screen shows a cleanup button only when matching imported tasks exist.
- Cleanup removes batch-tracked Personal Rhythm tasks.
- Cleanup removes future metadata-tagged Personal Rhythm block tasks.
- Cleanup does not remove ordinary user tasks or unrelated source-tagged tasks.
- Cleanup saves app collections with the `personal_schedule_task_cleanup` reason.
- Personal Rhythm focused tests pass locally.
- No production deploy is performed.

## Verification

- `node --check public/js/personal-schedule-planner.js`
- `node --check public/js/personal-schedule-ui.js`
- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --check tests/personal-schedule-planner.test.mjs`
- `node --check tests/personal-schedule-assets.test.mjs`
- `node --test tests/personal-schedule-planner.test.mjs tests/personal-schedule-assets.test.mjs`
