# Voice Transcription Diagnostics Log

Spec id: VOICE-TRANSCRIPTION-DIAGNOSTICS-LOG-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-065
Date: 2026-07-31

## Goal

Record recent account-scoped voice transcription attempts for diagnostics without storing audio or recognized text.

TASK-064 added a provider adapter boundary. Before a live STT provider is connected, Focus needs backend diagnostics that show whether requests are locked, invalid, quota-blocked, provider-missing, failed, or successfully transcribed.

## Scope

- Add bounded `transcriptionEvents` storage to the sync JSON state.
- Load older JSON state files without `transcriptionEvents`.
- Expose `GET /api/sync/transcription/events` for the current account.
- Record locked, invalid, quota-exceeded, provider-not-configured, failed, and transcribed outcomes.
- Store metadata only: status, provider, reason, MIME type, language, text length, usage snapshot, spend flag, device id, and timestamp.
- Do not store `audioBase64`, raw audio, or recognized `text`.

## Out Of Scope

- Client UI for viewing transcription diagnostics.
- Admin dashboard or cross-account diagnostics.
- Audio payload storage.
- Recognized text storage.
- Live STT provider integration.
- PWA service worker cache bump.
- Production deployment.
- Git push or release tagging.

## Acceptance Criteria

- Existing state files without `transcriptionEvents` load normally.
- The transcription endpoint records diagnostic events for terminal outcomes.
- Successful provider responses record `spent: true` and the post-spend usage snapshot.
- Failed, provider-missing, invalid, locked, and quota-blocked responses do not record audio or text payloads.
- `GET /api/sync/transcription/events` returns recent events for the current account only.
- Existing focused and full tests pass locally.
