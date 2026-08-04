# Daily Quotes Client

## Scope

Focus shows a daily set of five quotes in the app shell and a dedicated quotes modal. The client keeps a local cache for offline display, supports category preferences, and lets the current sync account track favorites.

## In Scope

- Load today's quote set through the existing sync client with account/device headers where available.
- Render a compact quote card on the main dashboard and a full daily quotes modal.
- Persist the latest quote set in local cache for offline display.
- Let users save quote category preferences for the next local day.
- Let users toggle quote favorites without changing other sync collections.
- Include app-shell and client contract tests.

## Out Of Scope

- Public quote submission workflow.
- New auth, database, or frontend app.
- External quote provider integration.
- Production deploy, push, or credential changes.

## Verification

- `tests/focus-sync-client.test.mjs`
- `tests/focus-storage.test.mjs`
- `tests/sync-integration-assets.test.mjs`
- Current full local regression on 2026-08-04: `npm.cmd run test` passed 219/219.
