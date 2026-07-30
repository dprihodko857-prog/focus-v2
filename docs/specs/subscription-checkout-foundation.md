# Subscription Checkout Foundation

Status: IMPLEMENTED_LOCAL_COMMITTED

## Context

`voiceTranscription` is planned as a subscription-gated feature. TASK-045 added account entitlements, and TASK-046 added the UI shell. The next step is a backend/client checkout contract so the `Оформить` action has a real API path before a payment provider is selected.

## Scope

- Add `POST /api/sync/checkout` for the current sync account/device.
- Accept only known paid feature keys, starting with `voiceTranscription`.
- Return `503 provider_not_configured` when no payment provider URL is configured.
- Return a prepared checkout URL when `FOCUS_SUBSCRIPTION_CHECKOUT_URL` is configured.
- Add sync client and app UI handling for ready, provider-missing, offline, invalid, and failed states.
- Bump the PWA service worker cache because app shell files changed.

## Out Of Scope

- Choosing or integrating a real payment provider.
- Payment webhooks.
- Server-side entitlement activation after payment.
- Subscription billing plans, prices, refunds, invoices, or taxes.
- Speech recording or transcription.
- Production deployment or git push.

## Behavior

- Without an account, the UI keeps asking the user to connect sync first.
- With an account and no provider configured, clicking `Оформить` shows that the checkout contract is ready but the provider is not connected.
- With a configured provider URL, backend appends `account` and `feature` query params and returns `status: "ready"`.
- Creating checkout does not enable `voiceTranscription`; entitlement activation remains a future webhook/admin step.

## Verification

- `node --check server/sync-server.mjs`
- `node --check public/js/sync.js`
- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --test tests/focus-sync-server.test.mjs tests/focus-sync-client.test.mjs tests/sync-integration-assets.test.mjs tests/desktop-layout-css.test.mjs tests/install-quality-css.test.mjs`
- `npm.cmd run test`
- `git diff --check`

## Result

TASK-047 adds a provider-ready checkout foundation for subscription-gated paid features. Service worker cache is `focus-pwa-v75`.
