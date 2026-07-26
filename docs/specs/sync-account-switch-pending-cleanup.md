# Sync Account Switch Pending Cleanup

Status: IMPLEMENTED_LOCAL

## Context

After pending collection/profile retries were added, switching the local device to another sync account could leave account-scoped pending queues from the previous account in local sync metadata.

## Goal

When the local sync account id changes, clear stale pending profile and collection push markers so old account work cannot be applied to the newly connected account.

## Scope

- Detect account changes inside `setAccountId`.
- Clear pending account profile updates when switching to a different account.
- Clear pending collection push markers when switching to a different account.
- Preserve pending device disconnect cleanup because it targets a previous account/device explicitly and must still retry.
- Bump the service worker cache because `sync.js` is part of the PWA shell.

## Out Of Scope

- Account deletion.
- Backend API changes.
- Multi-account queue storage.
- Conflict-resolution UI.
- Deployment, git push, tags, or production release.

## Acceptance Criteria

- Switching from one account id to another clears stale profile pending state.
- Switching from one account id to another clears stale collection pending state.
- Pending device disconnect cleanup survives account switching.
- Existing revision reset behavior remains unchanged.
- Existing sync and install-quality tests pass.

## Required Checks

- `node --check public/js/sync.js`
- `node --check public/service-worker.js`
- `node --test tests/focus-sync-client.test.mjs tests/sync-integration-assets.test.mjs tests/install-quality-css.test.mjs tests/desktop-layout-css.test.mjs`
- `npm.cmd run test`
