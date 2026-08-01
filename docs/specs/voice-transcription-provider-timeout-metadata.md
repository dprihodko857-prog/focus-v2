# Voice Transcription Provider Timeout Metadata

Spec id: VOICE-TRANSCRIPTION-PROVIDER-TIMEOUT-METADATA-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-072
Date: 2026-08-01

## Goal

Expose safe provider timeout metadata in transcription readiness diagnostics so the owner can verify the live STT configuration before enabling OpenAI credentials on the server.

TASK-071 added a bounded OpenAI provider timeout. TASK-072 surfaces that timeout as a non-secret readiness field and Settings summary detail.

## Scope

- Add `providerTimeoutMs` to `GET /api/sync/transcription/status`.
- Return `null` timeout for providers that do not expose a timeout.
- Normalize `providerTimeoutMs` in the sync client.
- Store `providerTimeoutMs` in Settings readiness state.
- Show the timeout in the Settings transcription readiness summary when present.
- Bump the PWA service worker cache.

## Out Of Scope

- Exposing provider URLs, API keys, organization ids, or project ids.
- Live provider verification.
- Changing provider timeout behavior.
- Changing transcription request, usage, or payment behavior.
- Production deployment.
- Git push or release tagging.

## Acceptance Criteria

- OpenAI readiness status returns the configured provider timeout.
- Local providers remain compatible with `providerTimeoutMs: null`.
- Sync client normalizes missing timeout to `0`.
- Settings summary shows timeout only when present.
- Existing focused and full tests pass locally.
