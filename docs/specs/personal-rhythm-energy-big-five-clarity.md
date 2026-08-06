# Personal Rhythm Energy And Big Five Clarity

## Context

TASK-121 keeps the current chat focused on `Персональный ритм дня`.
The `Энергия и плотность` step looked like a technical parameter form, and the
owner asked how the 20-question preference survey affects schedule generation.

## Scope

- Make the energy step explain the practical meaning of peak energy, density,
  focus-block length, breaks, hard-block streaks, and buffers.
- Remove remaining user-visible backend wording from Personal Rhythm survey
  copy and generation-failure copy.
- Make the local deterministic draft use the selected energy peak as the
  starting target for the primary focus block.
- Make completed Big Five scores affect the local deterministic draft style:
  preferred variant order plus small focus/break/buffer adjustments.
- Keep the AI request privacy model unchanged.
- Keep the work local only.

## Out Of Scope

- Server deployment.
- Holidays behavior.
- Backend schema changes.
- Creating social/family blocks unless the user already defines such goals.

## Acceptance Criteria

- The energy step has understandable labels and inline hints.
- The old `backend` wording does not render from the Personal Rhythm UI source.
- Focused Personal Rhythm tests pass.
- Full local regression passes.
- Browser verification confirms the energy step renders the new explanatory
  layout and no backend/provider status copy.

## Verification

- `node --check public/js/personal-schedule-ui.js`
- `node --check public/js/personal-schedule-planner.js`
- `node --check tests/personal-schedule-planner.test.mjs`
- `node --check tests/personal-schedule-assets.test.mjs`
- `node --test tests/personal-schedule-planner.test.mjs tests/personal-schedule-assets.test.mjs`
- `npm.cmd run test`
- `curl.exe -L http://127.0.0.1:8091/service-worker.js`
- In-app browser at `http://127.0.0.1:8091/?open=useful&local=personal-rhythm-energy-v148`

## Result

Implemented locally on 2026-08-05 with service worker `focus-pwa-v148`.
No server deploy, commit, or git push.
