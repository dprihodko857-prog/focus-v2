# Voice Transcription Readiness Status

Spec id: VOICE-TRANSCRIPTION-READINESS-STATUS-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-068
Date: 2026-08-01

## Goal

Show whether server-side voice transcription is ready before the user records audio.

The app already has subscription access, usage diagnostics, a server transcription endpoint, and a diagnostics journal. This task adds a lightweight readiness status so Settings can explain whether the backend STT provider is configured and what limits apply without requiring a failed dictation attempt first.

## Scope

- Add a current-account backend readiness endpoint for voice transcription.
- Return provider configured state, provider name, monthly limit, max recording duration, and check timestamp.
- Add a sync client method for the readiness endpoint with offline fallback.
- Merge readiness status into the Settings transcription journal summary.
- Keep diagnostics account-scoped and avoid audio/text payload storage.
- Bump the PWA service worker cache.

## Out Of Scope

- Live STT provider integration.
- Provider credential management.
- Subscription payment-provider changes.
- Admin dashboards.
- Production deployment.
- Git push or release tagging.

## Acceptance Criteria

- `GET /api/sync/transcription/status` returns current-account readiness diagnostics.
- Non-GET calls to the status endpoint return `method_not_allowed`.
- `scheduleSync.getTranscriptionStatus()` loads and normalizes readiness diagnostics.
- Settings shows whether STT is configured before the first recording attempt.
- Existing transcription diagnostics events remain unchanged and still exclude audio and recognized text.
- Existing focused and full tests pass locally.
