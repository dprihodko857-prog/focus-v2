# Notification Retry Diagnostics Spec

Status: DRAFT
Spec id: NOTIF-RETRY-001
Owner decision: runtime implementation pending
Template: SECURITY_PRIVACY_SPEC_TEMPLATE with JOB_QUEUE_SPEC_TEMPLATE retry fields

## Goal

Improve backend push reminder reliability by adding bounded retry state and clearer diagnostics for transient reminder delivery failures.

## Target User Or Actor

- App user who expects saved reminders to be delivered on the current account devices.
- Backend dispatcher that scans due reminders and sends Web Push payloads.
- App diagnostics UI that reports whether reminders are pending, delivered, blocked, failed, or retrying.

## Current Evidence

- `server/sync-server.mjs` already dispatches due reminders with `dispatchDueReminders`.
- Delivered reminders are protected by `pushDeliveries` keyed by reminder id and scheduled time.
- Push events are recorded by `savePushEvent` and exposed through `/api/push/events`.
- Expired subscriptions with HTTP `404` or `410` are removed.
- Existing tests cover single delivery, skipped delivery reasons, expired subscription removal, and push event loading.

## Assets

- Secrets: VAPID private key is server-side only and must not be logged or exposed.
- Personal data: account id, device id, push endpoint, reminder title, scheduled time, delivery status.
- User content: reminder title is sent as push notification body and may appear in delivery event history.
- Generated content: server diagnostics and push event records.
- Billing or auth records: none in scope.

## Trust Boundaries

- Frontend: reads diagnostics and can request test push; it must not decide server retry state.
- Backend: owns retry state, delivery state, event history, and push dispatch.
- Storage: existing JSON-backed sync database state.
- External services: browser/OS Web Push service reached through `web-push`.
- Local files: `.env` and secrets remain out of project memory and commits.

## Data Handling

- Collection: use existing reminders, subscriptions, and dispatch outcomes.
- Processing: classify push send outcomes as success, permanent subscription failure, or transient failure.
- Storage: add minimal retry metadata keyed by delivery key.
- Retention: retry metadata must be removed when delivery succeeds or when max attempts are exhausted; push event log remains capped by existing retention behavior.
- Export/delete: no new export or deletion workflow in this slice.
- Logging: do not log push endpoints, auth tokens, VAPID keys, or full subscription objects.

## In Scope For TASK-003

- Add server-side retry metadata for reminder push dispatch failures that are not permanent `404` or `410` subscription failures.
- Use a bounded retry policy with deterministic defaults:
  - max attempts: 3 total attempts per reminder delivery key
  - retry delay: 5 minutes after a transient failure
  - idempotency key: existing reminder delivery key
- Keep duplicate protection: a reminder is marked delivered only after at least one successful send.
- Expose retry counts in existing reminder delivery diagnostics, without adding a new public endpoint unless tests prove it is necessary.
- Record push events for retryable failure and max-attempt exhaustion.
- Add focused server tests and any client-contract tests needed for changed diagnostics.

## Out Of Scope

- New queue dependency, worker process, database engine, schema migration framework, or cloud service.
- Changing VAPID keys, auth, accounts, billing, email, SMS, CRM, or telemetry.
- Production deployment or backend service restart.
- Real-device push smoke tests.
- Time-zone redesign.
- UI redesign of the notification panel.
- Changing local reminder scheduling behavior.

## Retry Lifecycle

- Create: when a due reminder send has only transient failures and at least one active subscription remains.
- Start: next dispatcher pass may retry only when `nextRetryAt <= now`.
- Complete: first successful send saves delivery state, marks the reminder delivered, and clears retry metadata for the delivery key.
- Fail permanently: when max attempts are exhausted without success, diagnostics report a failed retry state and no duplicate delivery is recorded.
- Cancel: if the reminder is deleted, already delivered by client state, invalid, expired, or has no active subscriptions.
- Do not retry: permanent `404` or `410` subscription failures for removed endpoints.

## Acceptance Criteria For TASK-003

- A transient push failure does not set `deliveredAt` and creates retry metadata.
- A retry is skipped before `nextRetryAt`.
- A retry after `nextRetryAt` attempts delivery again.
- A successful retry saves `pushDeliveries`, updates the reminder `deliveredAt`, and clears retry metadata.
- A `404` or `410` response removes the expired subscription and does not create retry metadata for that endpoint.
- Max attempts prevent endless retry loops and appear in diagnostics/events.
- Existing successful delivery behavior remains unchanged.
- Existing event log remains capped and contains no secrets or full subscription payloads.

## Required Checks For TASK-003

- `node --check server/sync-server.mjs`
- `node --test tests/focus-sync-server.test.mjs`
- `npm.cmd test`
- `git status --short`
- `git diff --stat`

## Owner Gates

- Runtime implementation requires owner approval of `TASK-003`.
- Commit requires separate owner approval.
- Deployment, backend restart, live push testing, real secrets, and production configuration require separate owner approval.

## Open Questions

- Whether the owner wants retry status shown in the UI immediately or only kept in diagnostics/API for the first implementation slice.
- Whether retry delay should stay at 5 minutes or become configurable by environment variable after the first bounded implementation.

