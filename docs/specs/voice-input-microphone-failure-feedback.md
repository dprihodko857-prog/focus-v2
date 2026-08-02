# Voice Input Microphone Failure Feedback

Spec id: VOICE-INPUT-MICROPHONE-FAILURE-FEEDBACK-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-075
Date: 2026-08-02

## Goal

Show specific, actionable voice input messages when microphone access or browser speech recognition fails.

TASK-060 added local speech recognition and server recording fallback. TASK-075 keeps the same voice input flow but replaces generic microphone and recognition failures with messages that distinguish denied permission, missing microphone, busy microphone, unsupported constraints, interrupted capture, network speech-recognition failure, and no-speech cases.

## Scope

- Map `getUserMedia()` DOMException names to user-facing microphone messages.
- Map `SpeechRecognition.onerror` error codes to user-facing recognition messages.
- Keep the existing paid-feature gate, recording flow, transcription API, quota, and provider behavior unchanged.
- Bump the PWA service worker cache.

## Out Of Scope

- Requesting permissions before the user presses a voice input button.
- Persisting microphone permission diagnostics.
- Storing raw audio or recognized text.
- Changing backend transcription, provider, payment, or subscription behavior.
- Production deployment.
- Git push, tags, or release work.

## Acceptance Criteria

- `NotAllowedError`, `SecurityError`, and `PermissionDeniedError` show a permission-specific message.
- `NotFoundError` and related device-missing errors show a microphone-missing message.
- `NotReadableError` and related busy-device errors show a busy-microphone message.
- Speech-recognition `not-allowed`, `audio-capture`, `network`, `no-speech`, and `aborted` errors have specific messages.
- Existing voice input and server recording behavior remains unchanged.
- Existing focused and full tests pass locally.
