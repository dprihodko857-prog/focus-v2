# Calendar Status Backgrounds

## Context

TASK-092 introduced independent semantic calendar statuses with separate marker dots. After combined public/religious days were fixed in TASK-094, the month grid needed a calmer treatment that does not add an extra marker row inside every date cell.

## In Scope

- Render today, non-working, secular holiday, religious holiday, and working weekend statuses as layered date-cell background bands.
- Keep user event markers separate from semantic status rendering.
- Keep semantic date status classes and accessible date labels.
- Preserve normal and hover base backgrounds under status overlays.
- Bump the service worker cache for the CSS/JS change.
- Cover the contract with static calendar/PWA tests.

## Out Of Scope

- Changing holiday source data or server APIs.
- Changing holiday preferences or event editing behavior.
- Production deployment, git push, tags, or release work.

## Verification

- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --test tests/desktop-layout-css.test.mjs tests/install-quality-css.test.mjs tests/legal-pages.test.mjs tests/sync-integration-assets.test.mjs`
- `npm.cmd run test`
- `git diff --check`
