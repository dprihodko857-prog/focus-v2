# Holiday Merged Status Metadata

## Context

The holiday catalog can contain system events with the same date and title from different calendars. After TASK-092 the month grid needs every semantic event type to survive duplicate merging so a single day can show combined public, religious, non-working, and working-weekend statuses.

## In Scope

- Preserve merged system event ids, event types, calendar kinds, calendar titles, and religious traditions.
- Preserve official non-working status when any merged duplicate has it.
- Keep user events distinct from system duplicate merging.
- Teach calendar status detection to inspect both the primary event type and merged event types.
- Bump the service worker cache to `focus-pwa-v115`.
- Cover the behavior with holiday catalog and static calendar tests.

## Out Of Scope

- Changing holiday catalog source data.
- Changing server APIs or holiday preferences.
- Changing event modal editing behavior.
- Production deployment, git push, tags, or release work.

## Verification

- `node --check public/js/app.js`
- `node --check public/js/holiday-catalog.js`
- `node --check public/service-worker.js`
- `node --test tests/holiday-catalog.test.mjs tests/desktop-layout-css.test.mjs`
- `npm.cmd run test`
