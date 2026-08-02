# Voice Transcription Processing Time Diagnostics

Spec id: VOICE-TRANSCRIPTION-PROCESSING-TIME-DIAGNOSTICS-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-073
Date: 2026-08-02

## Goal

Show how long the backend waited for transcription provider processing in the account-scoped dictation diagnostics journal.

TASK-071 added provider timeout handling, and TASK-072 exposed the configured timeout in readiness diagnostics. TASK-073 records safe per-attempt processing time so support can distinguish quick provider failures from slow provider calls without storing audio or recognized text.

## Scope

- Measure elapsed time around the backend transcription provider call.
- Store bounded `processingMs` in transcription diagnostic events.
- Keep locked, invalid, and quota-blocked events compatible with `processingMs: 0`.
- Normalize missing or invalid processing time safely.
- Show processing time in the Settings dictation journal when present.
- Bump the PWA service worker cache.

## Out Of Scope

- Storing raw audio or recognized text in diagnostics.
- Provider-side latency tracing beyond the single backend elapsed time field.
- Live OpenAI verification.
- Changing transcription success, quota, entitlement, or payment behavior.
- Production deployment.
- Git push or release tagging.

## Acceptance Criteria

- Successful and provider-failed transcription events include bounded `processingMs`.
- Pre-provider events remain compatible and expose `processingMs: 0`.
- Settings journal shows processing time only when present.
- Existing focused and full tests pass locally.
