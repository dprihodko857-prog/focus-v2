# Voice Input Foundation

Status: IMPLEMENTED_LOCAL_COMMITTED

## Context

The owner plans speech-to-text as a subscription-gated feature inside Useful/Settings. YooKassa verification is pending, so the app can prepare a local browser-first voice input foundation without real payment activation or external transcription providers.

## Goal

Wire existing `Диктовать` buttons to a common voice input flow gated by the `voiceTranscription` entitlement.

## Scope

- Add voice targets to reminder, task, note, birthday note, diary entry, and schedule wizard buttons.
- Use browser `SpeechRecognition` / `webkitSpeechRecognition` when entitlement is active.
- Insert recognized text into the active or configured text field.
- Route locked access through the existing `voiceTranscription` paid feature action.
- Show button-local status for locked, unsupported, listening, success, and failure states.
- Bump the service worker cache.
- Add focused static integration tests.

## Non-Goals

- External speech provider integration.
- Audio upload/storage.
- Server-side transcription.
- Entitlement activation without payment.
- Production deploy.

## Acceptance Criteria

- Voice buttons declare explicit text targets.
- Voice recognition is unavailable until `voiceTranscription` is enabled.
- Locked voice actions use the existing paid feature checkout flow.
- Active voice input writes recognized text into the target field and dispatches input/change events.
- Unsupported browsers show a disabled/status state.
- Existing focused tests pass locally.

## Verification

- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --test tests/sync-integration-assets.test.mjs tests/desktop-layout-css.test.mjs tests/install-quality-css.test.mjs tests/legal-pages.test.mjs`
- `npm.cmd run test`
