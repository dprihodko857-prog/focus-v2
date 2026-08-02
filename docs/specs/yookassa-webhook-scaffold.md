# YooKassa Webhook Scaffold

Status: IMPLEMENTED_LOCAL_COMMITTED

## Context

Focus Plus needs automatic entitlement activation after payment. YooKassa verification is still pending, and real payment creation is not implemented yet, but the backend can prepare the receiving side for `payment.succeeded` notifications.

## Scope

- Add a backend webhook route at `/api/yookassa/webhook`.
- Keep the route disabled unless `FOCUS_YOOKASSA_WEBHOOK_TOKEN` is configured.
- Accept a secret token through `?token=...`, `?webhookToken=...`, `x-focus-yookassa-token`, or `Authorization: Bearer ...`.
- Parse YooKassa notification bodies with `type: "notification"`, `event`, and `object`.
- Activate `voiceTranscription` only for `payment.succeeded` with `object.status: "succeeded"` and `object.paid: true`.
- Read account and feature from payment metadata.
- Ignore non-activating or unmatched notifications with HTTP 200 so the provider does not retry forever.
- Keep the public app UI unchanged.

## Out Of Scope

- Creating real YooKassa payments.
- YooKassa shop credentials.
- Server-side API verification of current payment status.
- IP allow-list enforcement.
- Receipts, refunds, recurring payments, invoices, or fiscalization.
- Subscription expiration and renewal logic.
- Production deploy, git push, tags, or release work.

## Required Payment Metadata

The future payment creation step must include one of these account keys:

- `accountId`
- `focusAccountId`
- `account`

It must also include one of these feature keys:

- `featureKey`
- `focusFeatureKey`
- `feature`

For the first paid feature, the feature value must normalize to `voiceTranscription`.

## Behavior

- Without `FOCUS_YOOKASSA_WEBHOOK_TOKEN`, `/api/yookassa/webhook` returns `404 not_found`.
- Requests with a missing or wrong token return `401 yookassa_webhook_token_required`.
- Invalid notification JSON returns an existing JSON parse error.
- Invalid notification shape returns `400 invalid_yookassa_notification`.
- Non-succeeded payment events return `200 { "status": "ignored" }`.
- Missing metadata, unknown accounts, and unknown features return `200 ignored` and do not activate access.
- A valid paid succeeded payment for an existing account enables `voiceTranscription` with source `yookassa`.

## Verification

- `node --check server/sync-server.mjs`
- `node --test tests/focus-sync-server.test.mjs`
- `npm.cmd run test`
- `git diff --check`

## Result

TASK-053 prepares the backend to receive YooKassa `payment.succeeded` notifications and activate `voiceTranscription` from payment metadata. This is still a scaffold: the next payment task should create real YooKassa payments with the required metadata and verify current payment status before relying on live provider events.
