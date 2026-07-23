# PUSH-EVENT-DETAILS-001 - Retry Details In Push Event Log

Owner decision: autonomous continuation approved in chat on 2026-07-23.

## Goal

Show retry attempt details from existing server push events inside the reminders notification center.

## Context

- TASK-003 added server retry metadata and push event fields: `attempts`, `maxAttempts`, and `nextRetryAt`.
- The reminders notification center already shows delivery diagnostics and the recent push event log.
- Before this task, the event log showed only sent/failed/removed counts, so retry events were less actionable for QA.

## In Scope For TASK-007

- Include attempt count in push event details when the server provides it.
- Include next retry time in push event details when the server provides it.
- Keep the existing event API contract unchanged.
- Bump the service worker cache because `app.js` is part of the app shell.
- Add/update contract tests for the UI helper functions and cache id.

## Out Of Scope

- Backend retry policy changes.
- New push endpoints.
- Push event retention changes.
- Visual redesign of the reminders center.
- Production deployment, git push, tags, or release work.

## Acceptance Criteria

- Push events still show sent/failed/removed counts.
- Retryable push events can show `попытка X/Y`.
- Retryable push events can show the next retry time.
- Existing `sent`, `empty`, `no-subscriptions`, `failed`, and `retry-exhausted` labels remain unchanged.
- Existing notification diagnostics remain unchanged.

## Required Checks

- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --test tests/install-quality-css.test.mjs tests/sync-integration-assets.test.mjs`
- `npm.cmd run test`
- `git status --short`
- `git diff --stat`
