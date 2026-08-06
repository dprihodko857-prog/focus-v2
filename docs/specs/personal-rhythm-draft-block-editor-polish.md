# Personal Rhythm Draft Block Editor Polish

Status: IMPLEMENTED_LOCAL_PENDING_COMMIT

Task: TASK-124

## Problem

After the Personal Rhythm survey reached a draft, the editable block list still
felt like a technical table. Users could change times, but the screen did not
clearly explain what each row represented: day/time, title, category, duration,
flexibility, and quick actions were visually compressed together.

## Scope

- Keep the existing draft-edit behavior and import logic unchanged.
- Present each editable draft block as a readable card.
- Show the weekday and time range as a visible stamp.
- Keep the editable title prominent.
- Show category, duration, and flexibility as compact metadata chips.
- Label time inputs as "Начало" and "Конец".
- Keep quick actions for earlier/later, shorter/longer, fixed-time toggle, and
  removal.
- Add category-aware accent colors without changing internal category ids.
- Keep the work local only.

## Out Of Scope

- Server deployment.
- Changing generated draft logic.
- Changing backend endpoint contracts.
- Fixing unrelated Daily Quotes behavior or tests.
- Holidays behavior.

## Acceptance Criteria

- Draft blocks render with `personal-schedule-block-row__summary`,
  `personal-schedule-block-row__stamp`, and
  `personal-schedule-block-row__meta`.
- Each row preserves `data-ps-category` for category styling.
- The row clearly separates title, metadata, time inputs, quick actions, and
  rationale.
- Mobile layout has no horizontal overflow at a narrow viewport.
- Local service worker cache is current for the working copy.
- Focused Personal Rhythm tests pass.
- Browser verification covers the draft editor on the local app.

## Verification

- `node --check public/js/personal-schedule-ui.js`
- `node --check public/service-worker.js`
- `node --check tests/personal-schedule-assets.test.mjs`
- `node --test tests/personal-schedule-planner.test.mjs tests/personal-schedule-assets.test.mjs`
- `node --test tests/personal-schedule-planner.test.mjs tests/personal-schedule-assets.test.mjs tests/desktop-layout-css.test.mjs tests/install-quality-css.test.mjs tests/legal-pages.test.mjs tests/sync-integration-assets.test.mjs`
- Browser automation at `http://127.0.0.1:8091/?open=useful&local=personal-rhythm-block-editor-v156`
- Mobile browser metrics at `390x844`
- `npm.cmd run test`
- `git diff --ignore-cr-at-eol --check`

## Result

Implemented locally on 2026-08-05 with service worker `focus-pwa-v156`.
Focused Personal Rhythm checks passed, expanded affected checks passed, and
browser verification confirmed readable desktop/mobile draft block layout with
no Backend wording and no mobile horizontal overflow. Full regression currently
passes 290/291 and fails only the unrelated Daily Quotes display contract that
expects `icon-copy` while the current dirty working tree renders `icon-share`.
No server deploy, commit, or git push.
