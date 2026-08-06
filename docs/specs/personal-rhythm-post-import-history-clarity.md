# Personal Rhythm Post-Import History Clarity

Status: IMPLEMENTED_LOCAL_PENDING_COMMIT

Task: TASK-126

## Problem

After a Personal Rhythm draft was imported, the history screen did not clearly
explain what had just happened. The user needed a readable result state that
answers three questions immediately: what was added, where to find it in Focus,
and how to roll the import back.

## Scope

- Keep the existing import batch, apply, rollback, and cleanup behavior.
- Add a latest-import result card to the Personal Rhythm history step.
- Show visible counts for schedules, optional tasks, and optional reminders.
- Show a visible "where to find it" section with destinations for each object
  type.
- Keep rollback available from the latest import result and history rows.
- Rename the history step from "История планировщика" to "История ритма дня".
- Keep the work local only.

## Out Of Scope

- Server deployment.
- Changing import batch data contracts.
- Changing generated draft logic.
- Changing Daily Quotes, Holidays, Diary, or other app sections.
- Changing internal `personal_schedule_planner` ids.

## Acceptance Criteria

- The history step renders `personal-schedule-import-result` for the latest
  import batch.
- The latest-import result visibly includes `Добавлено в Focus`.
- The result visibly includes `Где искать добавленное`.
- The result shows three destination cards for schedule, tasks, and reminders.
- Applied history rows expose `data-ps-import-status="applied"`.
- Rolled-back history rows keep a distinct rolled-back state.
- The latest import exposes a rollback button while the batch is applied.
- Mobile layout has no horizontal overflow at 390px width.
- Local service worker cache is current for the working copy.
- Focused Personal Rhythm tests, expanded affected tests, browser verification,
  full local regression, and diff-check pass.

## Verification

- `node --check public/js/personal-schedule-ui.js`
- `node --test tests/personal-schedule-planner.test.mjs tests/personal-schedule-assets.test.mjs`
- `node --test tests/personal-schedule-planner.test.mjs tests/personal-schedule-assets.test.mjs tests/desktop-layout-css.test.mjs tests/install-quality-css.test.mjs tests/legal-pages.test.mjs tests/sync-integration-assets.test.mjs`
- Browser automation at `http://127.0.0.1:8093/?open=useful&local=personal-rhythm-post-import-v159-e2e`
- Mobile browser metrics at `390x844`
- `npm.cmd run test`
- `curl.exe -L http://127.0.0.1:8093/service-worker.js`
- `git diff --ignore-cr-at-eol --check`

## Result

Implemented locally on 2026-08-06 with service worker `focus-pwa-v159`.
Focused Personal Rhythm checks passed 25/25, expanded affected checks passed
79/79, browser automation verified the post-import result on desktop and
390px mobile, full regression passed 292/292, and diff-check passed with only
LF-to-CRLF warnings. No server deploy, commit, or git push.
