# Voice Recording Limit Feedback

Spec id: VOICE-RECORDING-LIMIT-FEEDBACK-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-076
Date: 2026-08-02

## Goal

Make the server recording fallback limit visible before and during recording, and show a clear status when the app stops recording automatically at the limit.

The MediaRecorder fallback already uses `VOICE_RECORDING_MAX_MS` to cap short audio samples before server transcription. TASK-076 keeps that limit unchanged but makes it understandable in the UI so mobile users are not surprised when recording stops and moves into transcription.

## Scope

- Render the current recording limit in the recording-ready hint.
- Render the current recording limit while recording is active.
- Track when `VOICE_RECORDING_MAX_MS` stops the recorder automatically.
- Show a limit-reached message before submitting the recording for transcription.
- Keep manual stop, transcription payload, quota, provider, and payment behavior unchanged.
- Bump the PWA service worker cache.

## Out Of Scope

- Changing the 15 second recording limit.
- Adding recording countdown UI.
- Storing raw audio or recognized text.
- Changing backend transcription, provider, payment, or subscription behavior.
- Production deployment.
- Git push, tags, or release work.

## Acceptance Criteria

- Voice recording ready state mentions the current recording limit.
- Active recording state mentions the current recording limit.
- Auto-stop by `VOICE_RECORDING_MAX_MS` is tracked separately from manual stop.
- Auto-stopped recordings show a limit-reached status before transcription submission.
- Existing focused and full tests pass locally.
