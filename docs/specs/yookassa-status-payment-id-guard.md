# YooKassa Status Payment Id Guard

Spec id: YOOKASSA-STATUS-PAYMENT-ID-GUARD-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-085
Date: 2026-08-03

## Goal

Activate paid Focus Plus features from `/api/sync/checkout/status` only when YooKassa returns the same payment id that the client asked the backend to verify.

Even though the backend requests a specific YooKassa payment URL, the entitlement activation path should be defensive: a malformed, mocked, or unexpected provider response for another payment must not activate the current account's paid feature.

## Scope

- Normalize `payment.id` from the YooKassa status response.
- Ignore status responses with a missing provider payment id as `payment_id_missing`.
- Ignore status responses where provider `payment.id` differs from the requested payment id as `payment_id_mismatch`.
- Audit ignored payment id failures through entitlement events.
- Keep webhook behavior unchanged because webhook notifications do not have a separate requested payment id.
- Keep successful activation, account matching, feature matching, amount/currency guard, and pending/canceled behavior unchanged.

## Out Of Scope

- Calling live YooKassa APIs.
- Changing pending checkout storage.
- Changing YooKassa webhook processing.
- Changing client UI.
- Production deployment.
- Git push, tags, or release work.

## Acceptance Criteria

- A paid status response for another provider payment id returns `ignored` with `payment_id_mismatch`.
- The mismatched provider id is returned in the diagnostic response.
- The mismatch is written to entitlement audit events.
- The paid feature entitlement remains inactive.
- Existing focused and full tests pass locally.
