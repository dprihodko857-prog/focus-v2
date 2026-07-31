# Voice Transcription Usage Diagnostics UI

Spec id: VOICE-TRANSCRIPTION-USAGE-UI-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-062
Date: 2026-07-31

## Goal

Show account-scoped voice transcription usage diagnostics in the existing subscription UI.

TASK-061 added backend quota tracking. This task makes the current monthly usage visible to the user in Settings and Useful surfaces.

## Scope

- Include feature usage diagnostics in `GET /api/sync/entitlements`.
- Normalize usage diagnostics in the sync client.
- Store usage diagnostics in the app paid feature state.
- Render used, limit, remaining, and reset time for `voiceTranscription`.
- Show the same compact diagnostics in Settings and Useful.
- Bump the PWA service worker cache.

## Out Of Scope

- Live STT provider integration.
- Admin usage reset controls.
- Billing changes.
- New subscription plans.
- Production deployment.
- Git push or release tagging.

## Acceptance Criteria

- `/api/sync/entitlements` includes `usage.voiceTranscription`.
- Sync client returns normalized `usage.voiceTranscription` from `getAccountEntitlements()`.
- Offline entitlement checks return `usage.voiceTranscription: null`.
- Settings paid feature card shows usage text and a progress bar.
- Useful subscription panel shows the same usage diagnostics.
- Static and full regression tests pass locally.
