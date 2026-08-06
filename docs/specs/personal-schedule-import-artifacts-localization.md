# Personal Schedule Import Artifacts Localization

## Status

IMPLEMENTED_LOCAL_COMMITTED

## Task

TASK-099 localizes Personal Schedule Planner import artifacts that are written into existing Focus collections.

## Scope

- Keep the planner domain model, generated draft structure, sync client, backend provider routes, and service worker cache unchanged.
- Replace the user-visible English feature name in imported schedule notes and schedule details with "Персональный ритм дня".
- Preserve stable internal machine identifiers such as `personal_schedule_planner` for source filtering and rollback safety.
- Extend planner unit coverage so future import changes do not reintroduce the English feature name into user-visible schedule artifacts.

## Acceptance

- Imported schedule `note` mentions "Персональный ритм дня".
- Imported schedule `note` does not contain `Personal Schedule Planner`.
- Imported schedule `details["Источник"]` is "Персональный ритм дня".
- Imported task/reminder `source` fields remain `personal_schedule_planner`.
- Existing import and rollback behavior remains unchanged.
- Focused planner tests and full regression pass locally.

## Out Of Scope

- Live AI provider credentials or provider routing.
- Sync/backend API changes.
- UI shell redesign.
- Production deployment, git push, or release tagging.
