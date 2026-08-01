# Voice Transcription Provider Metadata

Spec id: VOICE-TRANSCRIPTION-PROVIDER-METADATA-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-070
Date: 2026-08-01

## Goal

Expose safe transcription provider metadata in readiness diagnostics so the owner can verify which STT model is configured before dictation attempts.

TASK-069 added the OpenAI provider adapter. The readiness status already reports whether a provider is configured, but it did not show the configured model. TASK-070 adds the model name only, without exposing API keys, provider URLs, organization ids, project ids, prompts, audio, or recognized text.

## Scope

- Add `providerModel` to the current-account transcription readiness endpoint.
- Normalize `providerModel` in the sync client.
- Store `providerModel` in Settings readiness state.
- Show provider model in the Settings transcription summary when available.
- Keep local/test providers compatible by returning `null` model when no model is configured.
- Bump the PWA service worker cache.

## Out Of Scope

- Exposing provider API keys.
- Exposing provider endpoint URLs.
- Live provider checks.
- Changing transcription request or usage-spending behavior.
- Production deployment.
- Git push or release tagging.

## Acceptance Criteria

- `GET /api/sync/transcription/status` includes `providerModel`.
- OpenAI readiness status returns the configured transcription model.
- Local providers remain compatible with `providerModel: null`.
- Settings summary shows the model only when present.
- Existing focused and full tests pass locally.
