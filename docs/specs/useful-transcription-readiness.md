# Useful Transcription Readiness

Spec id: USEFUL-TRANSCRIPTION-READINESS-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-077
Date: 2026-08-02

## Goal

Show server-side voice transcription readiness in the Useful hub subscription panel.

The app already exposes voice transcription access and usage in Useful, and Settings already shows server transcription readiness. TASK-077 brings the same readiness summary into Useful so the user can understand whether paid voice input is ready, still waiting for provider setup, or temporarily unavailable without opening Settings.

## Scope

- Render the current transcription readiness summary in the Useful subscription panel.
- Re-render the Useful subscription panel when transcription status/events are refreshed.
- Keep existing entitlement, usage, payment, provider, and transcription request behavior unchanged.
- Add static coverage for the new Useful readiness surface.
- Bump the PWA service worker cache.

## Out Of Scope

- Wiring live STT credentials.
- Changing transcription quota, duration limit, or provider timeout.
- Adding a separate Useful diagnostics journal.
- Changing YooKassa checkout or webhook behavior.
- Production deployment.
- Git push, tags, or release work.

## Acceptance Criteria

- Useful shows a readable readiness line when current transcription status is available.
- Useful updates the readiness line after transcription status/events refresh.
- The readiness line uses safe metadata only and does not expose provider secrets.
- Existing focused and full tests pass locally.
