# Personal Schedule Planner UI Polish

## Status

IMPLEMENTED_LOCAL_COMMITTED

## Task

TASK-098 localizes and polishes the Personal Schedule Planner shell that was introduced in TASK-097.

## Scope

- Keep the existing planner domain model, sync contract, backend mock provider, import, and rollback behavior unchanged.
- Localize visible planner UI copy in the Useful card, intake wizard, review step, import preview, history, status messages, and Big Five answer scale.
- Keep technical/privacy language explicit: raw notes, diary entries, and personal event titles are not sent.
- Use clear Russian weekday abbreviations in the planner weekday picker.
- Keep the Personal Schedule Planner static assets cache-busted through the current app shell cache.
- Verify desktop and mobile browser rendering for the current local shell.

## Acceptance

- The Useful card exposes "Персональный ритм дня" and opens the planner wizard.
- The modal kicker, titles, actions, field labels, status text, review summary, privacy notes, and history actions are Russian-first.
- The period weekday picker renders `Пн`, `Вт`, `Ср`, `Чт`, `Пт`, `Сб`, and `Вс`.
- The review step does not expose raw enum labels such as `quick`, `typical_day`, or `balanced`.
- The modal body remains scrollable and its final review warning is visible above the footer actions on mobile.
- Static, planner, and full regression tests pass locally.
- Browser QA captures desktop and mobile screenshots.

## Verification

- `node --check public/js/app.js`
- `node --check public/js/personal-schedule-ui.js`
- `node --check public/js/personal-schedule-planner.js`
- `node --check public/service-worker.js`
- Focused static/planner checks passed locally.
- `npm.cmd run test` passed 244/244 locally on 2026-08-04.
- Browser QA on `http://127.0.0.1:5177/` confirmed Useful card, planner modal, review step, mobile viewport `390/390` with no horizontal overflow, and expected static-server `/api` 404s only.
- Screenshots:
  - `output/playwright/personal-schedule-v119-desktop.png`
  - `output/playwright/personal-schedule-v119-mobile.png`

## Out Of Scope

- Live AI provider credentials or provider selection.
- Entitlement gating changes.
- Production deployment, git push, or release tagging.
