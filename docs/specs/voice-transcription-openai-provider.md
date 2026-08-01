# Voice Transcription OpenAI Provider

Spec id: VOICE-TRANSCRIPTION-OPENAI-PROVIDER-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-069
Date: 2026-08-01

## Goal

Prepare the backend for a real server-side STT provider while keeping production safe when live credentials are not configured.

TASK-064 introduced a provider boundary and a local test provider. TASK-069 adds an OpenAI transcription provider adapter behind environment configuration so the Focus Plus dictation path can later be enabled without changing the client contract.

## Scope

- Add an `openai` voice transcription provider config.
- Keep the provider disabled unless an API key and provider selection are configured.
- Send entitled transcription requests to the OpenAI audio transcription endpoint as multipart form-data.
- Include audio file, model, JSON response format, language, and optional prompt.
- Normalize successful provider text and keep existing usage-spending rules.
- Map provider authentication, quota/rate, rejected-audio, unavailable, and generic failures into safe diagnostics.
- Keep transcription diagnostics free of audio payloads and recognized text storage.
- Bump the PWA service worker cache.

## Environment Contract

- `FOCUS_VOICE_TRANSCRIPTION_PROVIDER=openai`
- `FOCUS_OPENAI_API_KEY` or `OPENAI_API_KEY`
- Optional `FOCUS_OPENAI_TRANSCRIPTION_MODEL` or `OPENAI_TRANSCRIPTION_MODEL`; default is `gpt-transcribe`.
- Optional `FOCUS_OPENAI_TRANSCRIPTION_URL` or `OPENAI_TRANSCRIPTION_URL`; default is `https://api.openai.com/v1/audio/transcriptions`.
- Optional `FOCUS_OPENAI_ORGANIZATION` / `OPENAI_ORG_ID` / `OPENAI_ORGANIZATION`.
- Optional `FOCUS_OPENAI_PROJECT` / `OPENAI_PROJECT_ID`.

## Out Of Scope

- Setting production secrets.
- Live network verification against OpenAI.
- UI changes to collect provider credentials.
- Subscription payment-provider changes.
- Production deployment.
- Git push or release tagging.

## Acceptance Criteria

- Missing OpenAI API key leaves provider readiness as not configured.
- Configured OpenAI provider sends multipart form-data to the transcription endpoint.
- Successful OpenAI transcription spends one monthly usage unit.
- OpenAI provider failures do not spend monthly usage.
- Provider failure reasons are shown as safe diagnostic labels in Settings.
- Existing focused and full tests pass locally.
