# YooKassa Payment Amount Guard

Spec id: YOOKASSA-PAYMENT-AMOUNT-GUARD-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-084
Date: 2026-08-02

## Goal

Activate paid Focus Plus features only when a terminal paid YooKassa payment matches the configured tariff amount and currency.

The current Focus Plus tariff is configured server-side as `199.00 RUB`. YooKassa webhook notifications and return-status checks must not activate `voiceTranscription` if the payment object is missing amount data, has a different amount, or has a different currency.

## Scope

- Check `payment.amount.value` and `payment.amount.currency` before entitlement activation.
- Apply the check to both `/api/yookassa/webhook` and `/api/sync/checkout/status`.
- Return and audit `amount_missing`, `amount_mismatch`, or `currency_mismatch` for terminal paid payments that do not match the configured tariff.
- Keep pending, canceled, account-mismatch, missing-feature, unknown-feature, duplicate-payment, provider-failure, and provider-not-configured behavior unchanged.
- Preserve scaffold compatibility when `yookassaConfig` is not configured.
- Include normalized amount and currency in new YooKassa webhook replay keys.

## Out Of Scope

- Changing the Focus Plus price.
- Adding multiple tariffs or currencies.
- Calling live YooKassa APIs.
- Changing client UI.
- Production deployment.
- Git push, tags, or release work.

## Acceptance Criteria

- A successful paid YooKassa webhook with a mismatched amount is ignored and does not activate access.
- A successful paid YooKassa checkout-status response with a mismatched currency is ignored and does not activate access.
- Matching `199.00 RUB` payments still activate `voiceTranscription`.
- Ignored amount/currency failures are written to entitlement audit events.
- Existing focused and full tests pass locally.
