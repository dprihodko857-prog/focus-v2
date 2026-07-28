# Push Subscription Sanitization

Status: IMPLEMENTED_LOCAL_COMMITTED

Implementation note: TASK-035 implemented and committed locally on 2026-07-28; deployment remains postponed by owner.

## Context

The backend stores browser Push API subscriptions in the JSON sync database. Push subscriptions only need a small stable shape, but a client request can include extra fields inside the subscription object.

## Goal

Store only the expected push subscription fields and reject excessively large subscription strings.

## Requirements

- Store only `endpoint`, `expirationTime`, `keys.p256dh`, and `keys.auth` from a push subscription request, plus backend-managed metadata.
- Reject push subscription endpoints that are not HTTPS or exceed the accepted endpoint length.
- Reject push subscription key strings that exceed accepted key lengths.
- Keep normal valid Push API subscription saves and renewals unchanged.
- Add focused server tests for field sanitization and rejected oversized subscriptions.

## Out Of Scope

- Push provider changes.
- VAPID changes.
- Client UI changes.
- Production deploy, git push, tags, or release work.

## Acceptance

- A valid subscription with extra fields is stored without those extra fields.
- A valid subscription renewal still replaces the previous current-device subscription.
- An oversized subscription is rejected with `400 invalid_push_subscription`.
- Existing tests pass locally.
