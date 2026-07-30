# Voice Recording UI Scaffold

Spec id: VOICE-RECORDING-UI-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-060
Date: 2026-07-30

## Goal

Add a browser audio recording fallback for the subscription-gated voice transcription feature.

The existing Web Speech API path remains the preferred local speech-to-text path when the browser supports it. Browsers without `SpeechRecognition`, but with microphone capture and `MediaRecorder`, can record a short audio sample and submit it to the existing transcription API scaffold.

## Scope

- Keep voice controls behind the `voiceTranscription` entitlement.
- Prefer `SpeechRecognition` when available.
- Use `MediaRecorder` only as a fallback for browsers without local speech recognition.
- Record a bounded audio sample on the client and submit base64 audio metadata through `scheduleSync.transcribeAudio(...)`.
- Stop the active recording when the same voice button is pressed again.
- Surface clear statuses for recording, sending, provider-not-configured, locked, account-required, invalid request, offline, and generic failure cases.
- Do not store captured audio locally.

## Out Of Scope

- Connecting a live STT provider.
- Streaming audio.
- Usage quotas or billing metering.
- Uploading audio when `voiceTranscription` is not active.
- Production deployment.
- Git push or release tagging.

## Acceptance Criteria

- Voice input controls expose recording mode when entitled and `MediaRecorder` is available but `SpeechRecognition` is unavailable.
- The recording mode calls `navigator.mediaDevices.getUserMedia({ audio: true })`.
- The recording mode uses `MediaRecorder` with a short maximum recording window.
- Captured audio is converted to base64 and sent via `scheduleSync.transcribeAudio(...)`.
- Provider-missing responses are shown as a prepared-but-not-connected state instead of a silent failure.
- Existing voice dictation behavior remains unchanged on browsers with `SpeechRecognition`.
- PWA cache is bumped.
- Static and full test suites pass locally.
