# Personal Schedule Rename To Personal Rhythm

## Status

IMPLEMENTED_DEPLOYED_PENDING_COMMIT

## Task

TASK-107 renames the Personal Schedule Planner visible feature from "Идеальное расписание" to "Персональный ритм дня".

## Scope

- Rename the Useful feature card title.
- Rename the planner modal kicker/title and wizard fallback title.
- Rename imported schedule title, schedule note, and `details["Источник"]`.
- Rename import/rollback status messages that mention the feature.
- Keep stable internal ids, module names, storage keys, and `personal_schedule_planner` source ids unchanged for import, rollback, and compatibility.
- Bump the PWA service worker cache to `focus-pwa-v126`.

## Acceptance

- `public/index.html`, `public/js/app.js`, `public/js/personal-schedule-planner.js`, and `public/js/personal-schedule-ui.js` expose "Персональный ритм дня" where users see the feature name.
- Working runtime/test/spec files no longer expose "Идеальное расписание" except static guard assertions.
- Personal Schedule import artifacts keep internal rollback ids unchanged.
- Focused Personal Schedule/PWA static checks and full regression pass locally.

## Out Of Scope

- Renaming internal JavaScript module names, DOM ids, IndexedDB keys, backend routes, or source ids.
- Changing planner behavior, generated schedule structure, import validation, or rollback logic.
- Git push, tags, or release work.
