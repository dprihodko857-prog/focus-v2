# Push Subscription Empty Bucket Cleanup

Status: IMPLEMENTED_LOCAL_COMMITTED

Implementation note: TASK-037 implemented and committed locally on 2026-07-28; deployment remains postponed by owner.

## Context

The sync backend stores browser Push API subscriptions by account. Existing unsubscribe paths remove expired endpoints or current-device subscriptions, but when the last subscription is removed the account key can remain as an empty array in the JSON database.

This is harmless for delivery, but it leaves stale empty buckets in persistent state and makes future database inspection noisier.

## Goal

Remove empty push subscription buckets after the existing subscription removal paths run.

## Requirements

- Delete an account's `pushSubscriptions` key when its final subscription is removed.
- Keep `savePushSubscription` behavior unchanged for valid subscriptions.
- Keep current-device disconnect behavior unchanged, including the `removedPushSubscriptions` count.
- Keep expired `404` or `410` push endpoint removal behavior unchanged.
- Add focused server tests for last-subscription cleanup.

## Out Of Scope

- Time-based deletion of active subscriptions.
- Device session retention changes.
- Push provider changes.
- Client UI changes.
- Production deploy, git push, tags, or release work.

## Acceptance

- Removing the last current-device subscription deletes the empty account bucket.
- Removing an expired endpoint during dispatch deletes the empty account bucket.
- Removing one subscription while another remains keeps the account bucket with the remaining subscription.
- Existing tests pass locally.
