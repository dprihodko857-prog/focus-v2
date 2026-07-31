# Voice Transcription Provider Adapter

Spec id: VOICE-TRANSCRIPTION-PROVIDER-ADAPTER-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-064
Date: 2026-07-31

## Goal

Prepare the backend transcription endpoint for a real speech-to-text provider without requiring live credentials yet.

TASK-059 through TASK-062 added the entitlement-gated transcription API, recording UI, monthly quota, and usage diagnostics. The endpoint still returned `provider_not_configured` for every valid request. This task adds a server-side provider adapter boundary and a local test provider so the full success/failure path can be verified before wiring an external STT service.

## Scope

- Add `voiceTranscriptionProvider` server configuration.
- Keep the default provider state disabled and return `provider_not_configured`.
- Add a `localEcho` provider for local/staging end-to-end checks.
- Record monthly usage only after a successful transcription response.
- Do not spend monthly usage for provider-missing or provider-failed responses.
- Preserve the existing client response contract: `transcribed`, `failed`, `provider-not-configured`, `usage-limit-exceeded`, `locked`, and offline states.

## Configuration

Optional local provider environment:

- `FOCUS_VOICE_TRANSCRIPTION_PROVIDER=localEcho`
- `FOCUS_VOICE_TRANSCRIPTION_LOCAL_TEXT=<test text>`

The provider is disabled when `FOCUS_VOICE_TRANSCRIPTION_PROVIDER` is absent or unsupported.

## Out Of Scope

- OpenAI, Whisper, Google, Apple, or any other live STT provider calls.
- Provider credentials, model selection, or cost controls.
- Streaming transcription.
- Audio-duration based quota.
- Client UI changes.
- PWA service worker cache bump.
- Production deployment.
- Git push or release tagging.

## Acceptance Criteria

- Default entitled transcription requests still return `provider_not_configured` without spending usage.
- Configured `localEcho` requests return `status: "transcribed"` and response text.
- Successful provider responses spend one monthly usage unit.
- Provider failures return `status: "failed"` without spending usage.
- Existing focused and full tests pass locally.
