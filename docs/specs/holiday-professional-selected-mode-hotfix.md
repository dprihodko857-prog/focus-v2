# Holiday Professional Selected Mode Hotfix

Status: Implemented locally
Date: 2026-08-05

## Goal

Make the `selected` professional holiday mode reliably clickable in the local Holidays settings UI.

## Scope

- Keep the simple one-column professional direction checklist from TASK-116.
- Preserve `selected` mode in the UI draft even when no professional category is checked yet.
- Avoid re-normalizing the UI draft inside the professional mode change handler.
- Bump local app/CSS asset URLs to `focus-20260805-holiday-simple-categories-3`.
- Bump local PWA cache to `focus-pwa-v141`.
- Keep the work local-only; no server deployment.

## Verification

- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --check tests/sync-integration-assets.test.mjs`
- `node --test tests/sync-integration-assets.test.mjs tests/desktop-layout-css.test.mjs tests/holiday-catalog.test.mjs`
- `npm.cmd run test`
- `git diff --ignore-cr-at-eol --check`
- Local `http://127.0.0.1:5173/?local=holiday-simple-categories-3` serves the updated asset URLs and `focus-pwa-v141`.
- Browser click verification: clicking `selected` leaves `holidayProfessionalMode` as `selected` and enables all 19 category checkboxes.
