# Personal Rhythm Import Editable Copy

Status: IMPLEMENTED_LOCAL

Task: TASK-130

## Problem

After opening a saved Personal Rhythm import, the user could inspect the full
read-only rhythm but could not adjust it without passing the survey again.

## Scope

- Add `Сделать копию для правки` to the full imported rhythm detail.
- Convert saved `schedule.dayTimes` lines back into editable draft blocks.
- Preserve the original source intake/profile when the source draft is still in
  local history.
- Open the copied rhythm in the existing draft editor.
- When that copied draft is imported again, replace the source applied import:
  rollback the old batch first, then apply the updated batch.
- Keep the work local only.

## Out Of Scope

- Server deployment.
- Reworking the survey.
- Changing internal `personal_schedule_planner` ids.
- Editing Daily Quotes, Holidays, Diary, Greeting Assistant, or other app
  sections.

## Acceptance Criteria

- Full imported rhythm detail exposes `Сделать копию для правки`.
- The action creates a draft with editable blocks from the saved schedule.
- Copied blocks keep day, time range, title, inferred category, priority, and
  rationale.
- The draft validation ignores the source schedule while editing a replacement
  copy, so the rhythm does not conflict with itself.
- Confirming import for the copied draft explains that the old version will be
  replaced.
- Importing the copied draft rolls back the source batch and applies the new
  batch.
- Mobile layout keeps full-width action buttons without horizontal overflow.

## Verification

- `node --check public/js/personal-schedule-ui.js`
- `node --check tests/personal-schedule-assets.test.mjs`
- `node --test tests/personal-schedule-planner.test.mjs tests/personal-schedule-assets.test.mjs`
- Focused browser smoke for copy-to-draft and replace import

## Result

Implemented locally on 2026-08-06. Syntax checks passed for the Personal Rhythm
UI and asset test. Focused Personal Rhythm tests passed 25/25. Browser smoke at
`http://127.0.0.1:8093/?open=useful&local=personal-rhythm-import-copy-v130-smoke`
verified full-rhythm copy, editable draft creation, replacement notice,
replacement import rollback/apply behavior, and mobile action layout with no
horizontal overflow. Full `npm.cmd run test` passed 299/299; diff-check passed
with LF-to-CRLF warnings only. No server deploy or git push.
