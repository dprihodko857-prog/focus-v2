# YooKassa Webhook Replay Guard

Spec id: YOOKASSA-WEBHOOK-REPLAY-GUARD-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-063
Date: 2026-07-31

## Goal

Prevent repeated delivery of the same YooKassa webhook notification from applying entitlement logic or creating duplicate diagnostics.

YooKassa sends payment notifications with `type`, `event`, and `object`. The payment object carries the payment id in `object.id`, so Focus uses a deterministic provider-event key from the webhook event, payment id, payment status, paid flag, account metadata, and feature metadata.

## Scope

- Add bounded `processedProviderEvents` storage to the sync JSON state.
- Load older JSON state files without `processedProviderEvents`.
- Build a YooKassa webhook replay key from the notification payload.
- Check the replay key before running entitlement activation.
- Store successful webhook terminal processing results after the first pass.
- Return `ignored` with `webhook_event_already_processed` for exact replay delivery.
- Keep existing payment-id entitlement idempotency for previously applied payments.

## Out Of Scope

- YooKassa signature verification.
- Live YooKassa credentials or external payment calls.
- Refunds, receipts, recurring billing, or cancellation workflows.
- Client UI changes.
- PWA service worker cache bump.
- Production deployment.
- Git push or release tagging.

## Acceptance Criteria

- Existing state files without `processedProviderEvents` load normally.
- First valid `payment.succeeded` webhook can activate `voiceTranscription`.
- Repeating the same webhook payload returns `status: "ignored"` with `reason: "webhook_event_already_processed"`.
- Repeated webhook payloads do not create duplicate entitlement audit records.
- Existing YooKassa webhook authentication and invalid-shape behavior stay unchanged.
- Focused backend and full regression tests pass locally.
