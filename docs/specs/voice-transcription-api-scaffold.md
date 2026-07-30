# Voice Transcription API Scaffold

## Context

Focus Plus currently gates browser-based speech input through the `voiceTranscription` entitlement. This works where the browser supports `SpeechRecognition`, but a paid transcription feature needs a backend contract so a future provider can process recorded audio consistently across devices.

## Goal

Add a server/client transcription API scaffold that is account-scoped, entitlement-gated, and safe when no transcription provider is configured.

## Scope

- Add `POST /api/sync/transcription` for the current sync account.
- Require active `voiceTranscription` entitlement before accepting transcription requests.
- Validate JSON request shape before any provider work:
  - `audioBase64`
  - `mimeType`
  - optional `language`
  - optional `prompt`
- Keep request size bounded by the existing JSON body limit and an explicit audio base64 limit.
- Return `provider_not_configured` while no server transcription provider is wired.
- Add `scheduleSync.transcribeAudio(...)` for future UI wiring.
- Bump the PWA service worker cache to `focus-pwa-v84`.

## Out Of Scope

- Capturing audio in the browser UI.
- Calling OpenAI, Whisper, Google, Apple, or any other live transcription provider.
- Storing uploaded audio.
- Streaming transcription.
- Usage metering and billing quotas.
- Production deploy, git push, tags, or release work.

## API Contract

Request:

```json
{
  "audioBase64": "base64-audio",
  "mimeType": "audio/webm",
  "language": "ru-RU",
  "prompt": "optional context"
}
```

Locked response:

```json
{
  "error": "feature_locked",
  "status": "locked",
  "featureKey": "voiceTranscription"
}
```

Provider-missing response:

```json
{
  "error": "provider_not_configured",
  "status": "provider_not_configured",
  "featureKey": "voiceTranscription",
  "provider": null
}
```

## Acceptance Criteria

- Requests without a known sync account still fail through existing account checks.
- Requests for accounts without active `voiceTranscription` return locked state.
- Malformed transcription bodies are rejected.
- Entitled valid requests return explicit provider-missing state without storing audio or calling external services.
- Sync client exposes a transcription method with account-required, invalid-request, locked, provider-not-configured, success placeholder, and offline states.
- Existing focused and full tests pass locally.

## Verification

- `node --check server/sync-server.mjs`
- `node --check public/js/sync.js`
- `node --check public/service-worker.js`
- `node --test tests/focus-sync-server.test.mjs`
- `node --test tests/focus-sync-client.test.mjs`
- `node --test tests/sync-integration-assets.test.mjs tests/install-quality-css.test.mjs tests/desktop-layout-css.test.mjs tests/legal-pages.test.mjs`
- `npm.cmd run test`
- `git diff --check`
- `git status --short`
- `git diff --stat`
