# Voice Transcription Provider Failure Messages

Spec id: VOICE-TRANSCRIPTION-PROVIDER-FAILURE-MESSAGES-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-074
Date: 2026-08-02

## Goal

Show clear user-facing messages after server voice recording failures by using the safe provider failure reason already returned by the transcription API.

TASK-071 through TASK-073 added timeout and processing diagnostics for provider calls. TASK-074 carries the safe `reason` field through the sync client and lets the voice recording UI distinguish timeout, provider key, rate-limit, unavailable-provider, rejected-audio, empty transcription, and generic provider failure cases.

## Scope

- Preserve the existing transcription API response contract.
- Normalize provider failure reasons in the sync client before exposing them to UI code.
- Keep successful transcriptions compatible with `reason: null`.
- Show reason-aware messages in the recording status area after failed server transcription.
- Bump the PWA service worker cache.

## Out Of Scope

- Storing raw audio, recognized text, or provider secrets.
- Changing provider retry, timeout, quota, entitlement, or payment behavior.
- Live OpenAI verification.
- Production deployment.
- Git push, tags, or release work.

## Acceptance Criteria

- Failed server transcription responses expose a bounded safe `reason` in `scheduleSync.transcribeAudio()`.
- The recording UI passes `result.reason` into failure-message selection.
- Provider timeout, auth, rate-limit, rejected-audio, unavailable, empty, no-audio, and generic provider failure reasons have specific messages.
- Existing status-only messages for locked, account-required, invalid request, quota exceeded, provider-not-configured, and offline states remain unchanged.
- Existing focused and full tests pass locally.
