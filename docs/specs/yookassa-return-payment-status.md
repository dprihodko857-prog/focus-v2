# YooKassa Return Payment Status

## Context

TASK-054 creates YooKassa redirect payments and stores Focus account and feature metadata in the payment object. The webhook scaffold from TASK-053 remains the main automatic activation path, but an installed PWA also needs a return-path safety check: after the user comes back from YooKassa, the app should verify the last pending payment and refresh paid feature access.

## Goal

Add a server-side payment status check for the current sync account and a client-side pending checkout flow that can activate `voiceTranscription` after a confirmed YooKassa payment.

## Scope

- Add `GET /api/sync/checkout/status?paymentId=...`.
- Keep YooKassa credentials server-only.
- Fetch `GET {FOCUS_YOOKASSA_PAYMENTS_URL}/{paymentId}` through backend Basic Auth.
- Activate `voiceTranscription` only when the payment response has `status: "succeeded"`, `paid: true`, and matching Focus metadata.
- Store the pending YooKassa `paymentId` locally after checkout creation.
- Check pending payment status on app startup and online recovery.
- Clear pending payment state after terminal statuses: `activated`, `canceled`, `failed`, or `ignored`.
- Bump the PWA service worker cache to `focus-pwa-v80`.

## Out Of Scope

- Live YooKassa credentials or external live payment calls.
- Production deploy, git push, tags, or release work.
- Receipts, fiscalization, recurring billing, refunds, subscription periods, or webhook signature hardening.
- Frontend redesign.

## Runtime Contract

Required existing YooKassa env variables:

- `FOCUS_YOOKASSA_SHOP_ID`
- `FOCUS_YOOKASSA_SECRET_KEY`
- `FOCUS_YOOKASSA_RETURN_URL`

Optional env variables:

- `FOCUS_PLUS_AMOUNT_RUB`
- `FOCUS_YOOKASSA_PAYMENTS_URL`, default `https://api.yookassa.ru/v3/payments`

Backend status response states:

- `activated`: payment is succeeded, paid, and belongs to the current account.
- `pending`: YooKassa payment has not reached a terminal paid state yet.
- `canceled`: YooKassa payment is canceled.
- `ignored`: payment metadata is missing or belongs to another account/feature.
- `failed`: provider request failed or returned an error.
- `provider_not_configured`: YooKassa config is incomplete.

Client-facing status names use hyphenated variants where needed, for example `provider-not-configured`.

## Acceptance Criteria

- Missing YooKassa config returns `503 provider_not_configured`.
- Invalid payment ids return `400 invalid_payment_id`.
- YooKassa GET requests use server-side Basic Auth.
- Pending YooKassa payments do not activate access and remain queued locally.
- Canceled, failed, ignored, and activated statuses clear the local pending checkout record.
- Account metadata mismatch cannot activate access.
- Paid succeeded payment activates `voiceTranscription` with source `yookassa`.
- App startup and online recovery check pending subscription checkout state.
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

## Notes

The implementation follows the official YooKassa API model: GET payment status is read-only, `pending` is not treated as success, and webhook delivery remains the preferred asynchronous confirmation channel. The return-status check is a user-experience safety net for browser/PWA return flows.
