# Holiday Professional Category Discoverability

## Status

Implemented locally, pending commit.

## Context

After the RU-2026 professional holiday catalog grew from the initial seed to a broad list of professional, sector, force-agency, and military dates, the settings screen still showed category names only. With the larger catalog, users need quick context before choosing selected professional directions.

## Requirements

- Keep the existing holiday professional preference model unchanged.
- In the professional holiday settings category list, show how many catalog dates each category contains.
- Show a short example list for each category based on bundled or loaded catalog events.
- Make long category names and long holiday examples wrap cleanly inside the modal.
- Keep disabled selected-category controls visually clear when professional mode is not `selected`.
- Bump the PWA service worker cache to `focus-pwa-v130`.

## Non-Goals

- Add search or filtering inside the holiday settings modal.
- Add per-holiday selection toggles.
- Change the catalog event source data.
- Deploy to production without owner approval.

## Verification

- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --check tests/sync-integration-assets.test.mjs`
- `node --check tests/desktop-layout-css.test.mjs`
- focused holiday/PWA static tests passed 70/70
- `npm.cmd run test` passed 253/253
- `git diff --ignore-cr-at-eol --check` passed with LF-to-CRLF warnings only
