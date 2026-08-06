# Personal Rhythm Import Full Rhythm View

Status: IMPLEMENTED_LOCAL_PENDING_COMMIT

Task: TASK-129

## Problem

The post-import history showed a compact snapshot of the imported schedule, but
the user still could not open the full saved rhythm after completing the survey.
The history needed a clear read-only drill-down with every saved day and block.

## Scope

- Keep the existing Personal Rhythm import batch and rollback contracts.
- Add an `import-detail` UI step reachable from the latest import result and
  each import history row.
- Render the selected imported schedule as a full read-only rhythm with all
  `dayTimes` days and blocks.
- Show the saved schedule title, day count, block count, import status, optional
  schedule meta, task/reminder counts, and rollback action for applied batches.
- Parse schedule lines into time range and block title for easier scanning.
- Keep compact history snapshots from TASK-127 unchanged.
- Keep the work local only.

## Out Of Scope

- Server deployment.
- Changing generated draft logic.
- Changing import, rollback, storage, or sync data contracts.
- Editing Daily Quotes, Holidays, Diary, Greeting Assistant, or other app
  sections.
- Changing internal `personal_schedule_planner` ids.

## Acceptance Criteria

- History exposes a visible `Открыть ритм` action for imports that contain a
  schedule.
- The latest import result exposes `Открыть полный ритм`.
- Clicking either action opens `Полный ритм дня`.
- The detail view renders every imported day and every block from
  `schedule.dayTimes`.
- Block lines are split into a stable time column and readable title text.
- The detail footer shows schedule scope plus task and reminder counts.
- Applied batches can still be rolled back from the detail view.
- Missing/invalid selected imports show a clear empty state and a path back to
  history.
- Mobile layout has no horizontal overflow at 390px width.
- Local service worker cache and related tests match the current working copy.

## Verification

- `node --check public/js/personal-schedule-ui.js`
- `node --check public/service-worker.js`
- `node --check tests/personal-schedule-assets.test.mjs`
- `node --test tests/personal-schedule-planner.test.mjs tests/personal-schedule-assets.test.mjs`
- `node --test tests/personal-schedule-planner.test.mjs tests/personal-schedule-assets.test.mjs tests/desktop-layout-css.test.mjs tests/install-quality-css.test.mjs tests/legal-pages.test.mjs tests/sync-integration-assets.test.mjs`
- Browser smoke at `http://127.0.0.1:8093/?open=useful&local=personal-rhythm-import-detail-v165-smoke`
- Mobile browser smoke at `390x844`
- `npm.cmd run test`

## Result

Implemented locally on 2026-08-06 with service worker `focus-pwa-v166`.
Focused Personal Rhythm checks passed 25/25, expanded affected checks passed
80/80, browser smoke verified the full imported rhythm detail on desktop and
390px mobile with 4 days, 12 blocks, and no horizontal overflow, and full local
regression passed 297/297. No server deploy, commit, or git push.
