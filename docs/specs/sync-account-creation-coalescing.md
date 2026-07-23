# SYNC-ACCOUNT-001 - Coalesce Account Creation

Owner decision: autonomous continuation approved in chat on 2026-07-23.

## Goal

Prevent duplicate sync account creation when multiple client sync operations start at the same time before an account id has been saved locally.

## Context

- The sync client creates an account lazily through `POST /api/sync/accounts`.
- The app can start several sync flows during initial hydration.
- If no `focus-sync-account-id` exists yet, concurrent calls can race and create more than one remote account.
- Production access logs previously showed repeated account creation requests close together during app load.

## In Scope For TASK-004

- Add client-side in-flight account creation reuse.
- Keep the existing account id storage key and API contract.
- Add a focused client test proving concurrent `getAccountId()` calls share one creation request.
- Bump the service worker cache because `sync.js` is part of the app shell.

## Out Of Scope

- Backend account merge or cleanup.
- Auth account redesign.
- Cross-account migration.
- Deployment, push, tags, or release work.

## Acceptance Criteria

- Two concurrent `getAccountId()` calls without a stored account id produce one `POST /api/sync/accounts`.
- Both callers receive the same account id.
- The account id is stored locally after success.
- A failed account creation does not permanently poison future attempts.
- Existing sync behavior remains unchanged when an account id already exists.

## Required Checks

- `node --check public/js/sync.js`
- `node --test tests/focus-sync-client.test.mjs`
- `npm.cmd test`
- `git status --short`
- `git diff --stat`
