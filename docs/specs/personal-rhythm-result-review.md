# Personal Rhythm Result Review

Status: IMPLEMENTED_LOCAL_PENDING_COMMIT

Task: TASK-117

## Problem

After the Personal Rhythm survey, the draft result needed a clearer decision surface before import. The owner should immediately understand the generated week, the main rhythm balance, possible risks, and what will be added to Focus.

## Scope

- Improve the draft result screen before import.
- Add a compact result brief for the selected variant.
- Show rhythm summary metrics for sleep, work, focus, and rest.
- Show decision warnings for blocking conflicts, dense days, and missing focus blocks.
- Show a clear Focus import preview for schedules, tasks, and reminders.
- Improve the confirm-import screen so it uses the same object-level import preview.
- Keep changes local only. Do not deploy to the server.

## Behavior

The draft screen now starts with a readable result layer:

- selected variant title and rationale
- readiness pill: ready for import or needs edits
- sleep/work/focus/rest summary
- validation and density warnings
- Focus import impact preview
- grouped week overview and quick block editor remain available below

The confirm-import screen now explicitly shows how many schedules, tasks, and reminders will be created under the current import options.

## Acceptance Criteria

- The result screen includes an "Итог опроса" section.
- The result screen includes a "Краткий ритм дня" summary.
- The result screen includes warning/status rows before the day grid.
- The result screen includes "Что будет добавлено в Focus" import impact data before confirmation.
- The confirm-import screen explicitly shows "Что попадёт в Focus".
- The default import still creates one schedule and no task clutter unless the user enables tasks.
- The day grid and quick block editor remain available.
- Focused Personal Rhythm tests pass locally.
- Full local regression passes.
- No production deploy is performed.

## Verification

- `node --check public/js/personal-schedule-ui.js`
- `node --check public/service-worker.js`
- `node --check tests/personal-schedule-assets.test.mjs`
- `node --test tests/personal-schedule-planner.test.mjs tests/personal-schedule-assets.test.mjs`
- `npm.cmd run test`
- `git diff --ignore-cr-at-eol --check`
