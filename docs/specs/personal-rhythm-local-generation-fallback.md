# Personal Rhythm Local Generation Fallback

Status: IMPLEMENTED_LOCAL_PENDING_COMMIT

Task: TASK-123

## Problem

The Personal Rhythm survey could end in a dead end when the generation service
was unavailable. The UI already had a local deterministic generator, but the
real survey flow only accepted a successful sync response and otherwise showed
a blocking generation failure.

## Scope

- Keep the existing sync generation request as the first attempt.
- When sync generation does not return `draft_ready`, create a local
  deterministic draft from the same intake, Big Five scores, and existing Focus
  intervals.
- Mark fallback drafts with `source: "local_fallback"` and a safe reason code.
- Show the draft screen instead of returning to a failure state.
- Explain the fallback in the "Почему так составлено" panel.
- Remove user-visible Backend wording from the Personal Rhythm review screen.
- Keep the work local only.

## Out Of Scope

- Server deployment.
- Fixing unrelated Daily Quotes tests or UI.
- Changing the server generation endpoint contract.
- Changing internal `personal_schedule_planner` ids.

## Acceptance Criteria

- A failed/unavailable generation service still produces a draft result.
- The result screen includes "Локальный черновик" in the explanation panel.
- The modal status says the draft was assembled locally.
- The old dead-end "Не удалось сгенерировать расписание" state is not shown for
  service unavailability.
- Personal Rhythm UI source does not contain user-visible Backend wording.
- Focused Personal Rhythm tests pass.
- Browser verification covers the fallback path with a simulated 503.
- Local service worker cache is current for the working copy.

## Verification

- `node --check public/js/personal-schedule-ui.js`
- `node --check public/service-worker.js`
- `node --check tests/personal-schedule-assets.test.mjs`
- `node --test tests/personal-schedule-planner.test.mjs tests/personal-schedule-assets.test.mjs`
- `node --test tests/personal-schedule-planner.test.mjs tests/personal-schedule-assets.test.mjs tests/desktop-layout-css.test.mjs tests/install-quality-css.test.mjs tests/legal-pages.test.mjs tests/sync-integration-assets.test.mjs`
- Browser automation at `http://127.0.0.1:8091/?open=useful&local=personal-rhythm-fallback-v155`
- `curl.exe -L http://127.0.0.1:8091/service-worker.js`
- `git diff --ignore-cr-at-eol --check`

## Result

Implemented locally on 2026-08-05 with service worker `focus-pwa-v155`.
No server deploy, commit, or git push.
