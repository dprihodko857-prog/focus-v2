# Voice Transcription Provider Timeout

Spec id: VOICE-TRANSCRIPTION-PROVIDER-TIMEOUT-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-071
Date: 2026-08-01

## Goal

Prevent slow external STT provider calls from keeping the sync backend request open indefinitely.

TASK-069 added an OpenAI transcription adapter. TASK-071 adds a bounded timeout around that external request so an unavailable or slow provider becomes a normal transcription diagnostic instead of a hanging request.

## Scope

- Add a configurable OpenAI transcription timeout.
- Abort OpenAI transcription fetches when the timeout expires.
- Return safe `provider_timeout` diagnostics for aborted provider calls.
- Keep provider timeout failures free of monthly usage spending.
- Show a readable Settings journal reason for provider timeouts.
- Bump the PWA service worker cache.

## Environment Contract

- Optional `FOCUS_OPENAI_TRANSCRIPTION_TIMEOUT_MS` or `OPENAI_TRANSCRIPTION_TIMEOUT_MS`.
- Default timeout is 30000 ms.
- Maximum accepted timeout is 120000 ms.
- Invalid or missing timeout values fall back to the default.

## Out Of Scope

- Live OpenAI network verification.
- Changing the transcription request payload.
- Changing provider credentials or payment-provider behavior.
- Storing audio or recognized text.
- Production deployment.
- Git push or release tagging.

## Acceptance Criteria

- OpenAI transcription requests receive an `AbortSignal`.
- Timeout-aborted provider calls return `provider_timeout`.
- Timeout-aborted provider calls do not spend monthly usage.
- Settings diagnostics have a readable timeout label.
- Existing focused and full tests pass locally.
