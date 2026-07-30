# Entitlement Audit Log

## Context

Focus Plus now has YooKassa checkout creation, webhook activation, return-status verification, and time-bounded entitlements. Before live provider usage, the backend needs a small audit trail so payment and entitlement changes can be diagnosed without reading raw server logs or the full JSON database by hand.

## Goal

Record recent paid feature access events per sync account and expose them through an account-scoped diagnostics endpoint.

## Scope

- Add `entitlementEvents` to the sync JSON state.
- Preserve backward compatibility for existing database files without `entitlementEvents`.
- Record manual admin entitlement activation and disable events.
- Record YooKassa webhook terminal events:
  - `activated`
  - `ignored`
  - `canceled`
- Record YooKassa return-status terminal events:
  - `activated`
  - `ignored`
  - `canceled`
  - `failed`
- Do not record repeated `pending` payment checks.
- Keep only the latest 50 events per account.
- Add `GET /api/sync/entitlements/events` for the current sync account.
- Add sync client method `getEntitlementEvents()`.
- Bump the PWA service worker cache to `focus-pwa-v82`.

## Out Of Scope

- Public UI for the audit log.
- Export tools or admin dashboards.
- External analytics.
- Production deploy, git push, tags, or live provider calls.

## Event Shape

```json
{
  "id": "uuid",
  "accountId": "account-id",
  "featureKey": "voiceTranscription",
  "origin": "yookassa-webhook",
  "status": "activated",
  "source": "yookassa",
  "paymentId": "payment-id",
  "paymentStatus": "succeeded",
  "paid": true,
  "reason": null,
  "expiresAt": "2026-08-11T09:01:00.000Z",
  "createdAt": "2026-07-12T09:01:00.000Z"
}
```

Allowed origins:

- `admin`
- `yookassa-webhook`
- `yookassa-status`

Allowed statuses:

- `activated`
- `disabled`
- `ignored`
- `failed`
- `canceled`

## Acceptance Criteria

- Existing JSON state files load without `entitlementEvents`.
- Admin activation and disable actions record audit entries.
- YooKassa payment activation records payment id, provider status, paid flag, and expiration.
- Duplicate or ignored terminal payment events are recorded with a reason.
- Repeated pending status checks are not recorded.
- `GET /api/sync/entitlements/events` returns only the current account events.
- Sync client can load entitlement events and returns offline fallback safely.
- Existing focused and full tests pass locally.

## Verification

- `node --check server/sync-server.mjs`
- `node --check public/js/sync.js`
- `node --check public/service-worker.js`
- `node --test tests/focus-sync-server.test.mjs`
- `node --test tests/focus-sync-client.test.mjs`
- `node --test tests/sync-integration-assets.test.mjs tests/install-quality-css.test.mjs tests/desktop-layout-css.test.mjs tests/legal-pages.test.mjs`
- `npm.cmd run test`
- `git diff --check`
- `git status --short`
- `git diff --stat`
