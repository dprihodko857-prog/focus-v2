# Orbit Logout Device Cleanup

Status: IMPLEMENTED_LOCAL

## Context

Code-based sync disconnect removes the current server-side device session, server-side push subscriptions, and local browser push subscription. Orbit logout only cleared the local sync account id, leaving the current device cleanup path unused.

## Goal

When the user logs out from an Orbit-backed sync account, run the same current-device cleanup and local push unsubscribe steps before clearing the local sync account state.

## Scope

- Detect Orbit-backed local sync accounts during logout.
- Attempt current-device server cleanup through the existing sync client helper.
- Attempt local browser/PWA push unsubscribe through the existing notification helper.
- Clear local sync account state and reset sync diagnostics after logout.
- Bump the service worker cache because app shell JS changed.

## Out Of Scope

- Orbit Auth server changes.
- Account deletion.
- Browser notification permission reset.
- Push provider changes.
- Deployment, git push, tags, or production release.

## Acceptance Criteria

- Orbit logout attempts current-device server cleanup before local account clearing.
- Orbit logout attempts local browser push unsubscribe.
- Offline cleanup still uses the existing pending device disconnect retry queue.
- Local sync state and diagnostics are cleared after logout.
- Existing sync, notification, and install-quality tests pass.

## Required Checks

- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --test tests/sync-integration-assets.test.mjs tests/install-quality-css.test.mjs tests/desktop-layout-css.test.mjs`
- `npm.cmd run test`
