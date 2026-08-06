# Personal Rhythm Result Explanation

Status: IMPLEMENTED_LOCAL_PENDING_COMMIT

Task: TASK-122

## Problem

After the Personal Rhythm survey, the generated draft could still look like a
list of blocks without explaining why Focus arranged the day that way. The
default goal name "Главное дело дня" also made the concept feel unclear.

## Scope

- Rename the default primary goal to "Главный приоритет дня".
- Add a "Почему так составлено" explanation panel to the draft result.
- Explain how the selected energy peak affects placement of the main focus
  block.
- Explain how tempo settings affect focus length, breaks, dense days, and
  buffers.
- Explain how the 20-question profile tunes rhythm style when answers are
  completed, and state when it was skipped.
- Mention Focus constraints such as sleep, work windows, calendar conflicts,
  and dense days when they affect the generated draft.
- Keep the work local only.

## Out Of Scope

- Server deployment.
- Holidays behavior.
- Backend schema changes.
- Changing the internal `personal_schedule_planner` identifiers.

## Acceptance Criteria

- The old default "Главное дело дня" is not present in planner defaults.
- The draft overview includes "Почему так составлено".
- The explanation panel includes "Главный приоритет", "Темп дня", and
  "20 вопросов".
- Personal Rhythm UI copy does not expose backend/provider wording.
- Focused Personal Rhythm tests pass.
- Full local regression passes.
- Local service worker cache is current for the working copy.

## Verification

- `node --check public/js/personal-schedule-ui.js`
- `node --check public/js/personal-schedule-planner.js`
- `node --check public/service-worker.js`
- `node --check tests/personal-schedule-assets.test.mjs`
- `node --test tests/personal-schedule-planner.test.mjs tests/personal-schedule-assets.test.mjs`
- `npm.cmd run test`
- `curl.exe -L http://127.0.0.1:8091/service-worker.js`
- `git diff --ignore-cr-at-eol --check`

## Result

Implemented locally on 2026-08-05. The working copy service worker is
`focus-pwa-v151`. No server deploy, commit, or git push.
