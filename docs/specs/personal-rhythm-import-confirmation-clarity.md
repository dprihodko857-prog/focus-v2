# Personal Rhythm Import Confirmation Clarity

Status: IMPLEMENTED_LOCAL_PENDING_COMMIT

Task: TASK-125

## Problem

The Personal Rhythm confirmation step showed object counts, but it still did
not make the import decision obvious enough before the user pressed the final
button. Users needed to understand which Focus objects would be created now,
which optional objects stayed disabled, and what the schedule would contain.

## Scope

- Keep the existing import batch creation, validation, and apply/rollback logic.
- Add a clear import plan section to the confirmation step.
- Show the selected variant, draft source, block count, day count, and total
  planned duration.
- Show decision cards for schedule, tasks, and reminders.
- Make disabled tasks/reminders explicit when their checkboxes are off.
- Show examples of the first blocks that will live inside the imported
  schedule.
- Mention that the imported batch can be rolled back from Personal Rhythm
  history.
- Keep the work local only.

## Out Of Scope

- Server deployment.
- Changing the import batch contract.
- Changing generated draft logic.
- Changing Daily Quotes, Holidays, or other app sections.
- Changing internal `personal_schedule_planner` ids.

## Acceptance Criteria

- The confirmation step renders `personal-schedule-import-confirmation`.
- The confirmation step includes `Перед добавлением`, `Внутри расписания`, and
  rollback copy.
- It renders three `data-ps-import-decision` cards for schedule, tasks, and
  reminders.
- It keeps tasks/reminders visibly disabled until their checkboxes are enabled.
- It shows block examples inside the schedule.
- Mobile layout has no horizontal overflow at 390px width.
- Local service worker cache is current for the working copy.
- Focused Personal Rhythm tests, expanded affected tests, browser verification,
  full local regression, and diff-check pass.

## Verification

- `node --check public/js/personal-schedule-ui.js`
- `node --check public/service-worker.js`
- `node --check tests/personal-schedule-assets.test.mjs`
- `node --test tests/personal-schedule-planner.test.mjs tests/personal-schedule-assets.test.mjs`
- `node --test tests/personal-schedule-planner.test.mjs tests/personal-schedule-assets.test.mjs tests/desktop-layout-css.test.mjs tests/install-quality-css.test.mjs tests/legal-pages.test.mjs tests/sync-integration-assets.test.mjs`
- Browser automation at `http://127.0.0.1:8091/?open=useful&local=personal-rhythm-import-confirm-v157-desktop-only`
- Mobile browser metrics at `390x844`
- `npm.cmd run test`
- `curl.exe -L http://127.0.0.1:8091/service-worker.js`
- `git diff --ignore-cr-at-eol --check`

## Result

Implemented locally on 2026-08-06 with service worker `focus-pwa-v157`.
Focused Personal Rhythm checks passed 24/24, expanded affected checks passed
78/78, browser verification confirmed desktop and mobile import confirmation
layout, full regression passed 291/291, and diff-check passed with only
LF-to-CRLF warnings. No server deploy, commit, or git push.
