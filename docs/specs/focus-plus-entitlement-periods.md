# Focus Plus Entitlement Periods

## Context

TASK-052 through TASK-055 prepared paid feature activation for `voiceTranscription`: manual activation, YooKassa webhook activation, checkout payment creation, and return-status verification. The next required subscription step is to stop treating paid access as an indefinite flag and add an explicit access period.

## Goal

Represent Focus Plus access as a time-bounded entitlement that can be displayed in the UI and safely extended by new YooKassa payments.

## Scope

- Add `activatedAt`, `expiresAt`, and `paymentId` to paid feature entitlements.
- Keep disabled/default entitlements explicit with null period fields.
- Add `FOCUS_PLUS_PERIOD_DAYS`, default `30`.
- YooKassa webhook and return-status activation create a new 30-day access period by default.
- New payments extend from the current future `expiresAt` when the feature is already active.
- Duplicate YooKassa events for the same `paymentId` do not extend access again.
- Duplicate YooKassa events for an already expired same `paymentId` do not reactivate access.
- `GET /api/sync/entitlements` returns expired subscriptions as inactive with `source: "expired"` while preserving historical dates.
- Admin entitlement activation remains available for testing and can optionally accept an explicit `expiresAt`.
- Settings and Useful UI display the active expiration date or expired status.
- Bump the PWA service worker cache to `focus-pwa-v81`.

## Out Of Scope

- Recurring auto-payments.
- YooKassa receipts, fiscalization, refunds, cancellation flows, or renewal jobs.
- Subscription plan management beyond the current `voiceTranscription` feature.
- Production deploy, git push, tags, or live payment calls.

## Runtime Contract

Entitlement shape:

```json
{
  "enabled": true,
  "source": "yookassa",
  "updatedAt": "2026-07-12T09:20:00.000Z",
  "activatedAt": "2026-07-12T09:20:00.000Z",
  "expiresAt": "2026-08-11T09:20:00.000Z",
  "paymentId": "payment-id"
}
```

Disabled default shape:

```json
{
  "enabled": false,
  "source": "none",
  "updatedAt": null,
  "activatedAt": null,
  "expiresAt": null,
  "paymentId": null
}
```

Expired API shape:

```json
{
  "enabled": false,
  "source": "expired",
  "updatedAt": "2026-07-12T09:20:00.000Z",
  "activatedAt": "2026-07-12T09:20:00.000Z",
  "expiresAt": "2026-08-11T09:20:00.000Z",
  "paymentId": "payment-id"
}
```

## Acceptance Criteria

- Default disabled entitlements include null `activatedAt`, `expiresAt`, and `paymentId`.
- Active entitlements preserve activation and expiration timestamps.
- Expired server entitlements are returned as inactive without deleting historical dates.
- YooKassa activations set `activatedAt`, `expiresAt`, and `paymentId`.
- Duplicate YooKassa notifications for the same payment do not extend the period.
- Duplicate notifications after expiry do not reactivate the same payment.
- Client normalization preserves the new fields.
- UI surfaces show active expiration and expired states.
- Existing focused and full tests pass locally.

## Verification

- `node --check server/sync-server.mjs`
- `node --check public/js/sync.js`
- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --test tests/focus-sync-server.test.mjs`
- `node --test tests/focus-sync-client.test.mjs`
- `node --test tests/sync-integration-assets.test.mjs tests/install-quality-css.test.mjs tests/desktop-layout-css.test.mjs tests/legal-pages.test.mjs`
- `npm.cmd run test`
- `git diff --check`
- `git status --short`
- `git diff --stat`
