# YooKassa Checkout Payment

Status: IMPLEMENTED_LOCAL_COMMITTED

## Context

TASK-047 added a generic checkout contract, and TASK-053 added a YooKassa webhook scaffold. The next step is to let the existing `Оформить` action create a YooKassa redirect payment when provider credentials are configured, while preserving safe provider-missing behavior until the shop is approved and secrets are installed on the server.

## Scope

- Keep `POST /api/sync/checkout` as the app-facing checkout endpoint.
- Create a YooKassa payment through `POST https://api.yookassa.ru/v3/payments` when YooKassa checkout config is complete.
- Authenticate only from the backend with shop id and secret key.
- Send `Idempotence-Key` for payment creation.
- Use redirect confirmation with the configured return URL.
- Send `capture: true`.
- Send Focus Plus price in RUB, defaulting to `199.00`.
- Include account and feature metadata for the later webhook activation path.
- Return YooKassa `confirmation_url` to the existing client checkout flow.
- Keep fallback `FOCUS_SUBSCRIPTION_CHECKOUT_URL` behavior for non-YooKassa testing.

## Environment

Required for YooKassa checkout:

- `FOCUS_YOOKASSA_SHOP_ID`
- `FOCUS_YOOKASSA_SECRET_KEY`
- `FOCUS_YOOKASSA_RETURN_URL`

Optional:

- `FOCUS_PLUS_AMOUNT_RUB`, default `199.00`
- `FOCUS_YOOKASSA_PAYMENTS_URL`, default `https://api.yookassa.ru/v3/payments`
- `FOCUS_SUBSCRIPTION_CHECKOUT_URL`, retained as a non-YooKassa fallback when YooKassa config is incomplete

## Out Of Scope

- Live deploy or secret installation.
- YooKassa shop approval.
- Receipts, fiscalization, taxes, refunds, recurring payments, subscription periods, or cancellation management.
- Server-side polling of payment status after return URL.
- Frontend redesign.
- Git push, tags, or release work.

## Behavior

- Without complete YooKassa config and without fallback checkout URL, checkout still returns `503 provider_not_configured`.
- With fallback checkout URL and without YooKassa config, existing test-provider redirect behavior remains.
- With complete YooKassa config, backend creates a payment and returns `status: "ready"` with YooKassa `confirmation_url`.
- YooKassa provider API failures return `status: "failed"` without enabling access.
- YooKassa network failures return `status: "failed"` with `provider_unavailable` without enabling access.
- Creating a payment never enables `voiceTranscription`; activation remains the webhook/manual entitlement path.

## Verification

- `node --check server/sync-server.mjs`
- `node --test tests/focus-sync-server.test.mjs`
- `npm.cmd run test`
- `git diff --check`

## Result

TASK-054 connects the existing checkout contract to YooKassa payment creation behind server-only environment variables. The client continues to receive a redirect URL through the same `createSubscriptionCheckout` flow.
