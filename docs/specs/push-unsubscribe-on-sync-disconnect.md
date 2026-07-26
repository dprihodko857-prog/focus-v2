# Push Unsubscribe On Sync Disconnect

Status: IMPLEMENTED_LOCAL

## Context

Disconnecting a code-based sync account removes the current device session and server-side push subscriptions, but the browser/PWA PushManager subscription can remain locally active.

## Goal

When the current device is disconnected from a code-based sync account, also unsubscribe the local browser push subscription on a best-effort basis.

## Scope

- Add a notification client helper that reads the current PushManager subscription and unsubscribes it.
- Treat missing local subscriptions as a successful no-op.
- Report local browser unsubscribe failures without throwing.
- Call local push unsubscribe during the Settings sync disconnect flow.
- Keep local sync disconnect behavior unchanged if unsubscribe fails.
- Bump the service worker cache because app shell JS changed.

## Out Of Scope

- Browser notification permission reset. Browsers do not allow apps to revoke permission programmatically.
- Backend API changes.
- Account deletion.
- Push provider changes.
- Deployment, git push, tags, or production release.

## Acceptance Criteria

- Existing local PushManager subscription is unsubscribed during code-based sync disconnect.
- Missing local subscription does not block disconnect.
- Local unsubscribe failure does not throw or block disconnect.
- Server-side device cleanup and local account clearing remain unchanged.
- Existing notification, sync, and install-quality tests pass.

## Required Checks

- `node --check public/js/notifications.js`
- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --test tests/focus-notifications.test.mjs tests/sync-integration-assets.test.mjs tests/install-quality-css.test.mjs tests/desktop-layout-css.test.mjs`
- `npm.cmd run test`
