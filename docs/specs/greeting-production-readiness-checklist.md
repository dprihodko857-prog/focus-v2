# Greeting Production Readiness Checklist

Status: final keyless readiness gate for Focus Greeting Assistant. This checklist does not approve live provider calls, secret installation, deployment, model selection, or production activation by itself.

Date: 2026-08-13

Scope: Focus section "Compose greeting" only.

## Current Accepted State

- Default committed configuration keeps `FOCUS_GREETING_AI_PROVIDER=mock`.
- Full user flow works through `MockGreetingAIProvider` without live provider calls.
- `DisabledGreetingAIProvider` keeps the controlled unavailable state and still allows questionnaire draft saving.
- `PolzaGreetingAIProvider` is the selected ChatGPT-over-Polza.ai production direction, but production traffic is not active.
- `GigaChatGreetingAIProvider` remains a legacy/comparison adapter behind the shared contract, not the selected production direction.
- Future `YandexGreetingAIProvider` and `OpenAIGreetingAIProvider` can be added behind `GreetingAIProvider` without UI, draft model, or Greeting Assistant business-logic changes.

## Keyless Readiness Gate

These checks must pass before asking anyone to install a real provider key:

```text
npm run greeting:preflight
npm run test:greeting
npm run test:greeting:server
```

Required result:

- `npm run greeting:preflight` reports `status: "passed"` for local mock/default mode.
- `npm run greeting:preflight` keeps `liveProviderCallPerformed: false`.
- `npm run greeting:preflight` does not print API key, selected model id, base URL, bearer token, authorization header, or raw provider metadata.
- `npm run test:greeting` passes client-boundary, readiness, production-config, production-preflight, production-readiness-smoke, and model-comparison runner tests.
- `npm run test:greeting:server` passes fake-fetch Polza, fake-fetch GigaChat, provider factory, and sync greeting endpoint tests.
- `.env.example` contains only safe placeholders and keeps Polza production values commented or empty.
- Frontend assets contain no provider env names, provider URLs, bearer token markers, model ids, authorization headers, or direct provider endpoint calls.

## Stop Conditions

Stop before key installation if any of these are true:

- `FOCUS_GREETING_AI_PROVIDER=polza` is selected without both `FOCUS_POLZA_PRODUCTION_ENABLED=true` and `FOCUS_POLZA_MODEL_COMPARISON_APPROVED=true`.
- The model-comparison record for the selected model is missing, incomplete, or not approved.
- `FOCUS_POLZA_MODEL` was chosen in UI, mobile client, draft storage, localStorage, or client code instead of server configuration.
- Any client asset contains provider keys, model ids, provider base URLs, OAuth URLs, bearer tokens, or direct Polza/GigaChat endpoints.
- Provider output can save drafts, copy text, edit birthdays, edit holidays, create reminders, send messages, or mark a greeting as sent without explicit user action through Focus business logic.
- Any local or CI test requires a live provider call.
- Any report, doc, screenshot, terminal output, or chat message contains a real API key or bearer token.

## Production Activation Prerequisites

Do not proceed to production activation until all of these are true:

- Owner explicitly approves production activation and one live smoke.
- The model comparison matrix in `docs/specs/greeting-model-comparison.md` is complete for the selected model.
- Quality, Russian-language naturalness, ban compliance, no invented facts, distinct variants, no profanity, structured result validity, average latency, and cost per request are recorded.
- The selected model id is stored only in server configuration.
- The provider key is installed only through the server secret mechanism.
- `FOCUS_POLZA_PRODUCTION_ENABLED=true` and `FOCUS_POLZA_MODEL_COMPARISON_APPROVED=true` are set only after approval.
- `docs/specs/greeting-polza-production-smoke-report.md` is ready for sanitized live-smoke evidence.
- Rollback to `FOCUS_GREETING_AI_PROVIDER=disabled` is prepared and verified.

## User-Visible Acceptance

Before live activation, the accepted user-visible behavior is:

- mock-backed generation can create three editable greeting variants;
- revision works on mock-backed variants;
- draft save and restore work from the Greeting Assistant UI;
- controlled disabled state says generation is unavailable and still allows saving the questionnaire;
- no provider key, token, model id, provider URL, authorization field, or raw provider metadata appears in UI, DOM, draft payloads, or localStorage.

## Explicitly Not Approved Yet

- No real Polza key is requested in chat.
- No real Polza key is committed.
- No real Polza key is pasted into docs, tests, fixtures, screenshots, or terminal logs.
- No live Polza or GigaChat call is part of development, CI, mock smoke, disabled smoke, or this readiness checklist.
- No production provider is activated until the separate owner-approved activation procedure in `docs/specs/greeting-polza-production-runbook.md` is followed.
