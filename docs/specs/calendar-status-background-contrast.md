# Calendar Status Background Contrast

## Context

TASK-095 moved semantic calendar statuses from extra marker dots into date-cell background bands. In the deployed visual pass, the backgrounds were intentionally calm but too subtle for quick scanning, especially for today and non-working days.

## In Scope

- Increase opacity of today, non-working, secular holiday, religious holiday, and working weekend background layers.
- Keep the layered background model introduced in TASK-095.
- Keep user event markers separate from semantic status rendering.
- Keep accessible date labels and semantic status classes unchanged.
- Bump the service worker cache for the JavaScript/CSS-visible change.
- Cover the new opacity contract with static calendar/PWA tests.

## Out Of Scope

- Changing holiday source data or server APIs.
- Changing holiday preferences, calendar event editing, or user markers.
- Adding a calendar legend or explanatory UI.
- Production deployment, git push, tags, or release work.

## Verification

- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --test tests/desktop-layout-css.test.mjs tests/install-quality-css.test.mjs tests/legal-pages.test.mjs tests/sync-integration-assets.test.mjs`
- `npm.cmd run test`
- Playwright desktop/mobile browser sanity against `http://127.0.0.1:5177/`
- `git diff --check`
