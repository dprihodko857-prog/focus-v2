# Holiday Professional Selection Preview

## Status

Implemented locally, pending commit.

## Context

After the professional holiday catalog expanded and category cards gained counts/examples, users still needed to understand which exact professional dates would appear in the calendar after choosing "all" or selected directions.

## Requirements

- Keep the existing professional holiday preference model unchanged.
- Add a professional holiday preview block to the Holidays settings modal.
- For `none`, explain that professional dates are hidden.
- For `selected` without categories, ask the user to select directions.
- For `all` and selected categories, show the total matching professional date count and up to six nearest matching dates.
- Sort dates so the current catalog year shows upcoming dates first, then earlier dates.
- Show each preview item with a compact date, title, and readonly holiday type label.
- Keep long preview titles wrapped inside the modal.
- Bump the PWA service worker cache to `focus-pwa-v131`.

## Non-Goals

- Add per-holiday selection controls.
- Change server-side holiday preference schema.
- Add search/filter UI.
- Deploy to production without owner approval.

## Verification

- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --check tests/sync-integration-assets.test.mjs`
- `node --check tests/desktop-layout-css.test.mjs`
- focused holiday/PWA static tests passed 70/70
- `npm.cmd run test` passed 254/254
- `git diff --ignore-cr-at-eol --check` passed with LF-to-CRLF warnings only
