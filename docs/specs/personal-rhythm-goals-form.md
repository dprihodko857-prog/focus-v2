# Personal Rhythm Goals Form

## Context

TASK-119 replaces the technical goals textarea in `Персональный ритм дня`.
The old step exposed internal semicolon fields such as title, category,
priority, weekly frequency, duration, and preferred time in one text area. That
made the survey step hard to understand.

## Scope

- Replace the semicolon textarea with repeated goal cards.
- Keep the existing `intake.goals` data contract for planner generation.
- Let the user edit goal title, direction, importance, weekly frequency,
  duration, and preferred time through normal controls.
- Keep goal add/remove inside the same wizard step.
- Replace technical `backend/provider` copy in the modal status with
  user-facing generation-service copy.
- Keep the local PWA cache current. TASK-119 initially used `focus-pwa-v142`;
  later same-worktree cache-bust work superseded the final local cache to
  `focus-pwa-v146`.

## Out Of Scope

- Server deploy.
- Backend schema changes.
- Planner algorithm changes.
- Import, cleanup, or Holidays behavior changes.

## Acceptance Criteria

- The goals step shows structured cards and fields, not a raw textarea.
- The old strings `Одна цель на строку`, `learning; high`, and
  `Провайдер backend` do not render from the Personal Rhythm UI source.
- Focused Personal Rhythm tests pass.
- Full local regression passes.
- Local browser verification confirms four default goal cards, no old textarea,
  no technical example, and no backend/provider status copy.

## Verification

- `node --check public/js/personal-schedule-ui.js`
- `node --check public/service-worker.js`
- `node --check tests/personal-schedule-assets.test.mjs`
- `node --test tests/personal-schedule-planner.test.mjs tests/personal-schedule-assets.test.mjs`
- `npm.cmd run test`
- `curl.exe -L http://127.0.0.1:8091/service-worker.js`
- `git diff --ignore-cr-at-eol --check`
- In-app browser at `http://127.0.0.1:8091/?open=useful&local=personal-rhythm-goals-v146`

## Result

Implemented locally on 2026-08-05. No server deploy, commit, or git push.
