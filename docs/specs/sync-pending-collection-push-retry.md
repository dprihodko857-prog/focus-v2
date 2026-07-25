# Sync Pending Collection Push Retry

Status: IMPLEMENTED_LOCAL

## Context

Background collection pushes can fail while the app is offline. Before this change, the UI showed that sync would retry, but the sync client did not persist an explicit "this collection has a local snapshot to send first" flag.

## Goal

Remember failed background collection pushes and retry the local snapshot before pulling a newer remote snapshot during startup or online recovery sync.

## Scope

- Track pending local pushes for schedules, reminders, today tasks, notes, birthdays, and diary entries.
- Mark a collection pending when its background `push...` call returns an offline failure.
- Clear the pending marker after a successful push.
- During `sync...`, send the pending local snapshot first instead of pulling remote data over it.
- Clear pending collection markers when the local sync account is disconnected.
- Bump the service worker cache because `sync.js` is part of the PWA shell.

## Out Of Scope

- Multi-device merge/conflict UI.
- Per-item CRDT or server-side merge model.
- Backend API changes.
- Deployment, git push, tags, or production release.

## Acceptance Criteria

- Offline background push writes a pending collection marker.
- Online recovery sync retries the pending local snapshot before reading newer remote data.
- Successful retry clears the pending marker and updates the local revision.
- Existing non-pending pull behavior stays unchanged.
- Local sync disconnect clears stale pending collection markers.
- Existing sync and install-quality tests pass.

## Required Checks

- `node --check public/js/sync.js`
- `node --check public/service-worker.js`
- `node --test tests/focus-sync-client.test.mjs tests/sync-integration-assets.test.mjs tests/install-quality-css.test.mjs tests/desktop-layout-css.test.mjs`
- `npm.cmd run test`
