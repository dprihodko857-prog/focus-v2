# Voice Transcription Diagnostics UI

Spec id: VOICE-TRANSCRIPTION-DIAGNOSTICS-UI-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-066
Date: 2026-07-31

## Goal

Show recent account-scoped server transcription attempts in Settings so voice input diagnostics are visible before a live STT provider is connected.

TASK-065 added backend storage and `GET /api/sync/transcription/events`. The app now needs a compact owner-facing panel that explains whether a dictation attempt was blocked by subscription access, invalid input, monthly quota, missing provider, provider failure, or success.

## Scope

- Add sync client method `getTranscriptionEvents()`.
- Add a Settings panel for recent transcription diagnostics.
- Render account-required, loading, offline, empty, and populated states.
- Show only safe metadata: status, provider, reason, MIME type, language, text length, usage remaining, spend flag, and timestamp.
- Refresh diagnostics on Settings open, Useful open, account setup, app start, online recovery, manual paid-feature refresh, and after server recording transcription attempts.
- Bump the PWA service worker cache.

## Out Of Scope

- Live STT provider integration.
- Admin dashboard or cross-account diagnostics.
- Audio payload storage.
- Recognized text storage.
- Payment-provider changes.
- Production deployment.
- Git push or release tagging.

## Acceptance Criteria

- Settings contains a visible transcription diagnostics panel.
- The sync client exposes `getTranscriptionEvents()` and uses `/api/sync/transcription/events`.
- UI maps backend transcription statuses and reasons to readable Russian labels.
- The panel does not render raw audio or recognized text payloads.
- Service worker cache is bumped so installed PWAs receive the UI update.
- Existing focused and full tests pass locally.
