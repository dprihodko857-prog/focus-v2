# Voice Transcription Duration Metadata

Spec id: VOICE-TRANSCRIPTION-DURATION-METADATA-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-067
Date: 2026-07-31

## Goal

Carry bounded audio duration metadata through the voice transcription request and diagnostics journal before a live STT provider is connected.

The app already limits MediaRecorder capture length and the backend limits request size. This task adds `durationMs` as safe metadata so support diagnostics can distinguish short test clips from longer recordings and future STT provider work has a duration field ready.

## Scope

- Send `durationMs` from the MediaRecorder fallback path.
- Normalize `durationMs` in the sync client request body.
- Normalize `durationMs` on the backend while keeping older clients without the field compatible.
- Reject explicitly over-limit durations before provider work.
- Store normalized duration in transcription diagnostics events.
- Render duration in the Settings transcription journal.
- Bump the PWA service worker cache.

## Out Of Scope

- Decoding audio to independently verify real media duration.
- Audio-duration based billing or quota spending.
- Live STT provider integration.
- Payment-provider changes.
- Production deployment.
- Git push or release tagging.

## Acceptance Criteria

- `scheduleSync.transcribeAudio()` accepts `durationMs`.
- Server transcription requests include normalized `durationMs` when provided.
- Missing `durationMs` remains compatible and records as unknown/zero duration.
- Explicitly over-limit durations return `invalid_transcription_request`.
- Diagnostics events include `durationMs` but still exclude audio and recognized text payloads.
- Settings transcription journal shows human-readable duration when available.
- Existing focused and full tests pass locally.
