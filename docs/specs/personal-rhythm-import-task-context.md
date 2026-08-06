# Personal Rhythm Import Task Context

## Status

IMPLEMENTED_DEPLOYED_PENDING_COMMIT

## Task

TASK-113 fixes the confusing result after completing "Персональный ритм дня" when imported blocks appear as generic tasks in "Дела на сегодня".

## Scope

- Make task creation from blocks opt-in during import.
- Keep the default import focused on one schedule with day blocks.
- Give optional imported tasks a date key derived from the block weekday and planning start date.
- Give optional imported tasks and reminders visible time ranges in their titles.
- Give optional imported tasks a label with weekday, date, category, and "Персональный ритм".
- Keep internal `personal_schedule_planner` ids, schedule import, rollback ids, and backend routes unchanged.
- Deploy with PWA service worker cache `focus-pwa-v133`.

## Acceptance

- Passing the survey and importing with default options no longer fills "Дела на сегодня" with every generated block.
- If the user explicitly enables task creation, tasks no longer default to today's date unless the block is actually for today.
- Imported task titles include the block time range.
- Imported task labels include date/category context instead of the default "Личное".
- Reminder timestamps use the block date, not only the planning start date.
- Focused Personal Schedule/PWA static checks and full regression pass locally.

## Out Of Scope

- Automatic deletion of already imported tasks from existing user data.
- Changing the deterministic planner algorithm.
- Changing the Focus task card layout outside the imported data shape.
- Git push, tags, or release work.
