# Personal Rhythm Import Schedule Snapshot

Status: IMPLEMENTED_LOCAL_PENDING_COMMIT

Task: TASK-127

## Problem

The post-import history screen explained how many Focus objects were created,
but the user still could not see what was inside the imported schedule itself.
After completing the survey, the result needed to show the actual day/block
contents of the saved rhythm, not only destination counts.

## Scope

- Keep the existing Personal Rhythm import batch contract.
- Reuse imported schedule `dayTimes` from the latest applied batch.
- Add a "Что внутри расписания" snapshot to the latest-import result.
- Show the schedule title, day count, block count, optional schedule meta, and
  first visible day/block lines.
- Show a compact imported-schedule summary inside each import history row.
- Keep rollback, destination cards, and imported task cleanup behavior
  unchanged.
- Keep the work local only.

## Out Of Scope

- Server deployment.
- Changing generated draft logic.
- Changing import or rollback data contracts.
- Changing Daily Quotes, Holidays, Diary, or other app sections.
- Changing internal `personal_schedule_planner` ids.

## Acceptance Criteria

- The latest-import result renders `personal-schedule-import-snapshot`.
- The snapshot visibly includes `Что внутри расписания`.
- The snapshot shows the imported schedule title, day count, and block count.
- The snapshot shows at least the first visible day and first block lines from
  `schedule.dayTimes`.
- Hidden days and hidden blocks are summarized instead of overflowing the modal.
- Import history rows render `personal-schedule-history-import__summary`.
- The history row summary says `первый день`, not `первый блок`.
- Mobile layout has no horizontal overflow at 390px width.
- Local service worker cache is current for the working copy.
- Focused Personal Rhythm tests, expanded affected tests, browser verification,
  full local regression, and diff-check pass.

## Verification

- `node --check public/js/personal-schedule-ui.js`
- `node --check public/service-worker.js`
- `node --test tests/personal-schedule-planner.test.mjs tests/personal-schedule-assets.test.mjs`
- `node --test tests/personal-schedule-planner.test.mjs tests/personal-schedule-assets.test.mjs tests/desktop-layout-css.test.mjs tests/install-quality-css.test.mjs tests/legal-pages.test.mjs tests/sync-integration-assets.test.mjs`
- Browser automation at `http://127.0.0.1:8093/?open=useful&local=personal-rhythm-import-snapshot-v163-e2e`
- Mobile browser metrics at `390x844`
- `npm.cmd run test`
- `curl.exe -L http://127.0.0.1:8093/service-worker.js`
- `git diff --ignore-cr-at-eol --check`

## Result

Implemented locally on 2026-08-06 with service worker `focus-pwa-v163`.
Focused Personal Rhythm checks passed 25/25, expanded affected checks passed
80/80, browser automation verified the imported schedule snapshot on desktop
and 390px mobile, full regression passed 297/297, and diff-check passed with
only LF-to-CRLF warnings. No server deploy, commit, or git push.
