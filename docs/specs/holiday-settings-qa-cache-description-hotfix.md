# Holiday Settings QA Cache And Description Hotfix

Status: Implemented locally
Date: 2026-08-05

## Goal

Complete the local Holidays QA pass and fix defects found during the planned manual check.

## Scope

- Keep saved local holiday preferences when the sync API is offline.
- Do not let an offline default response overwrite the IndexedDB holiday preferences cache during hydration.
- Capitalize the first generated timing sentence when it follows an existing sentence in holiday detail descriptions.
- Keep professional category selection, religious selection, and color semantics unchanged.
- Use local app marker `focus-20260805-holiday-preferences-cache-2`.
- Keep current local PWA cache `focus-pwa-v145`.
- No server deployment.

## Verification

- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --check tests/sync-integration-assets.test.mjs`
- `node --test tests/sync-integration-assets.test.mjs tests/holiday-catalog.test.mjs tests/holiday-sync.test.mjs`
- `git diff --ignore-cr-at-eol --check`
- Local curl verified `http://127.0.0.1:5173/?local=holiday-qa-cache-2` serves `holiday-preferences-cache-2` and `focus-pwa-v145`.
- Browser QA verified `selected + construction_architecture` persists after reload while offline.
- Browser QA verified `Не показывать` removes `День строителя` from 9 August after restore.
- Browser QA verified religious green detail accent for `Успение Пресвятой Богородицы`.
- Browser QA verified secular working orange detail accent for `День географа`.
- Browser QA verified secular non-working red detail accent for `День строителя` on Sunday.

## Notes

- The broader desktop layout test currently fails on an unrelated `.app-shell--compact-window` CSS expectation in the dirty working tree; this QA task did not change that area.
