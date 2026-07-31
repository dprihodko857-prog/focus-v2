# Voice Transcription Usage Quota

Spec id: VOICE-TRANSCRIPTION-USAGE-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-061
Date: 2026-07-31

## Goal

Add account-scoped usage tracking and a monthly request quota for the subscription-gated voice transcription feature.

This prepares the backend for a real STT provider by ensuring transcription usage can be limited before provider calls become active.

## Scope

- Track `voiceTranscription` usage per account and calendar month.
- Configure the monthly request limit through `FOCUS_VOICE_TRANSCRIPTION_MONTHLY_LIMIT`.
- Default the monthly request limit when the environment variable is missing or invalid.
- Check quota after entitlement validation and request validation, but before provider work.
- Return `429 usage_limit_exceeded` when the monthly limit is exhausted.
- Return usage diagnostics in transcription responses.
- Do not spend quota while the provider is still not configured.

## Out Of Scope

- Live STT provider integration.
- Audio duration based billing.
- Payment-provider changes.
- Admin UI for usage resets.
- Production deployment.
- Git push or release tagging.

## Acceptance Criteria

- New accounts can read zero usage for the current month.
- Existing usage resets automatically when the calendar month changes.
- Exhausted usage returns a structured `usage_limit_exceeded` response.
- Provider-missing transcription responses include current usage diagnostics without incrementing usage.
- Sync client maps exhausted quota to `usage-limit-exceeded`.
- Voice UI shows a clear quota-exceeded message.
- PWA cache is bumped.
- Existing focused and full tests pass locally.
