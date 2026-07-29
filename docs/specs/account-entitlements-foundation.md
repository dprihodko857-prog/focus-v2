# ACCOUNT-ENTITLEMENTS-FOUNDATION-001 - Paid Feature Entitlements

Status: IMPLEMENTED_LOCAL_COMMITTED

## Context

The owner plans to add speech-to-text transcription as a paid feature that can be activated from Settings and grouped with other future services in the Useful section. Before payments or transcription UI are added, the app needs a stable backend/client contract for account-level feature access.

## Goal

Add a subscription-ready account entitlement foundation for paid features, starting with `voiceTranscription`.

## Requirements

- Store normalized account entitlements in the backend account record.
- Default `voiceTranscription` to disabled for every account.
- Add a server method for setting entitlements for future payment/webhook integration.
- Add `GET /api/sync/entitlements` for the current account/device.
- Reject missing or unknown account ids through the existing account validation path.
- Add a sync client method for loading account entitlements.
- Return a safe disabled entitlement state when the client is offline.
- Bump the service worker cache because `sync.js` is part of the PWA shell.
- Add focused server, client, and integration contract tests.

## Out Of Scope

- Payment provider integration.
- Subscription checkout UI.
- Payment webhook implementation.
- Speech recording, transcription upload, or speech-to-text parsing.
- Useful section UI changes.
- Production deploy, git push, tags, or release work.

## Implementation

- Accounts now carry normalized `entitlements`.
- `voiceTranscription` is the first entitlement and defaults to `{ enabled: false, source: "none", updatedAt: null }`.
- `db.setAccountEntitlements(...)` can enable paid features for future payment webhook work.
- `GET /api/sync/entitlements` returns current account entitlements.
- `scheduleSync.getAccountEntitlements()` loads entitlements and falls back to disabled access offline.
- The service worker cache was bumped to `focus-pwa-v73`.

## Acceptance

- New accounts expose disabled `voiceTranscription`.
- Enabled `voiceTranscription` can be stored and returned by the backend.
- The client can load entitlements through the sync API.
- Offline client entitlement checks default to disabled.
- Existing tests pass locally.
