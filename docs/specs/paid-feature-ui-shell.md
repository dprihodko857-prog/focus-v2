# Paid Feature UI Shell

Status: IMPLEMENTED_LOCAL_COMMITTED

## Context

The owner plans speech-to-text transcription as a subscription-gated feature. The backend/client entitlement contract already exposes `voiceTranscription`, but the app did not yet show where this access is managed.

## Scope

- Add a Settings surface for paid feature status.
- Add a Useful hub surface for the upcoming voice transcription feature.
- Read `voiceTranscription` access through `scheduleSync.getAccountEntitlements()`.
- Keep all paid features disabled by default unless the backend entitlement says otherwise.
- Bump the PWA service worker cache because app shell files changed.

## Out Of Scope

- Payment provider integration.
- Checkout redirect implementation.
- Subscription webhook handling.
- Microphone recording, speech upload, transcription provider calls, or text parsing.
- Production deployment or git push.

## Behavior

- Without a sync account, paid feature UI asks the user to connect an account first.
- With an account, the UI can refresh entitlement status from the backend.
- Offline entitlement checks show a blocked/offline state and keep the feature disabled.
- Enabled `voiceTranscription` is shown as active and disabled action buttons become non-interactive.
- Locked `voiceTranscription` shows that checkout will be connected in a later task.

## Verification

- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --test tests/sync-integration-assets.test.mjs tests/desktop-layout-css.test.mjs tests/install-quality-css.test.mjs`
- `npm.cmd run test`
- `git diff --check`

## Result

TASK-046 adds subscription-aware UI shells in Settings and Useful for the future voice transcription feature, backed by the existing account entitlement API. Service worker cache is `focus-pwa-v74`.
