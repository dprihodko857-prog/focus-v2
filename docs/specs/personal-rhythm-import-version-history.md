# Personal Rhythm Import Version History

Status: IMPLEMENTED_LOCAL

Task: TASK-131

## Problem

After an editable copy of a saved Personal Rhythm import replaced the active
schedule, history still looked like a normal rollback. The user needed to see
which import is the current version and which older import was replaced.

## Scope

- Mark replacement imports with `replacesImportBatchId`.
- Mark the source rolled-back batch with `rolledBackReason: "replaced"` and
  `replacedByImportBatchId`.
- Show `Новая версия применена` for updated active imports.
- Show `Заменён новой версией` for source versions replaced by a later import.
- Add a version trail to full imported-rhythm detail views.
- Keep manual rollback wording unchanged.
- Keep the work local only.

## Out Of Scope

- Server deployment.
- Changing Personal Rhythm backend/provider behavior.
- Reworking draft generation or survey steps.
- Editing Daily Quotes, Holidays, Diary, Greeting Assistant, or other app
  sections.

## Acceptance Criteria

- Replacement import history rows use `data-ps-import-status="updated"`.
- Replaced source rows use `data-ps-import-status="replaced"`.
- The latest import result says `Обновлено в Focus` for replacement imports.
- History rows expose `Открыть старую версию` and `Открыть новую версию` where
  both saved schedules are available.
- Full detail views explain whether the opened rhythm replaced an older import
  or was replaced by a newer one.
- Focused Personal Rhythm tests pass locally.
- Browser smoke verifies replacement history text and status markers.

## Verification

- `node --check public/js/personal-schedule-ui.js`
- `node --check tests/personal-schedule-assets.test.mjs`
- `node --test tests/personal-schedule-planner.test.mjs tests/personal-schedule-assets.test.mjs`
- `node output/playwright/personal-rhythm-import-copy-smoke.mjs <cached-playwright-module>`

## Result

Implemented locally on 2026-08-07. Focused Personal Rhythm tests passed 25/25.
Browser smoke verified copy-to-draft, replacement import, version labels,
`updated`/`replaced` row statuses, old/new version actions, and mobile
no-overflow layout. Full `npm.cmd run test` passed 299/299; diff-check passed
with LF-to-CRLF warnings only. No server deploy or git push.
