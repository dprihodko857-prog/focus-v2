# Greeting Polza.ai Production Runbook

Status: production activation guide only. This runbook does not approve deployment, secret installation, git push, or live provider calls by itself.

Scope: Focus Greeting Assistant only. Development and CI must continue to use `MockGreetingAIProvider` or `DisabledGreetingAIProvider` without real credentials.

Use `docs/specs/greeting-production-readiness-checklist.md` as the final keyless readiness gate before asking anyone to install a real provider key.
Use `docs/specs/greeting-polza-operator-handoff.md` as the short operator checklist for the actual activation order.

## External Contract

Official Polza.ai references verified on 2026-08-13:

- https://polza.ai/docs/api-reference/introduction
- https://polza.ai/docs/api-reference/chat/completions

Focus treats Polza as an OpenAI-compatible chat completions provider:

- server base URL: `https://polza.ai/api/v1`;
- chat endpoint: `/chat/completions`;
- authentication: server-only bearer API key;
- model id: server-side `FOCUS_POLZA_MODEL`;
- response body: `choices[0].message.content`, parsed as structured JSON and then validated by Focus.

Do not make frontend, mobile, local development, or CI calls directly to Polza.

## Production Gates

Before enabling `FOCUS_GREETING_AI_PROVIDER=polza`, all gates must pass:

- owner explicitly approves production activation and one live smoke;
- production source includes `PolzaGreetingAIProvider` behind the shared `GreetingAIProvider` contract;
- the model comparison matrix in `docs/specs/greeting-model-comparison.md` is completed for the selected model with sanitized JSONL from `scripts/greeting-model-comparison-runner.mjs`;
- server config includes explicit activation gates: `FOCUS_POLZA_PRODUCTION_ENABLED=true` and `FOCUS_POLZA_MODEL_COMPARISON_APPROVED=true`;
- expected average latency and cost per request are recorded;
- `.env.example` remains a placeholder-only committed reference;
- local and CI checks use fake provider calls only;
- no provider keys, model ids, provider URLs, tokens, or provider metadata are exposed to client assets or persisted drafts.

For the separate model comparison environment only, `FOCUS_POLZA_MODEL_COMPARISON_EVALUATION_ENABLED=true` may enable Polza before the final production gates are set. Do not use the evaluation gate for public production traffic.

## Server Secrets

Use the deployment secrets vault when available. If the current systemd deployment keeps secrets in `/opt/focus-v2/data/focus-v2.env`, edit that file only through an approved server-side secret workflow. Do not put real values in chat, shell history, screenshots, `.env.example`, docs, frontend code, mobile code, or git.

Required server-only values:

```text
FOCUS_GREETING_AI_PROVIDER=polza
FOCUS_POLZA_PRODUCTION_ENABLED=true
FOCUS_POLZA_MODEL_COMPARISON_APPROVED=true
FOCUS_POLZA_API_KEY=<server secret>
FOCUS_POLZA_MODEL=<selected model id>
```

Optional server-only values:

```text
FOCUS_POLZA_BASE_URL=https://polza.ai/api/v1
FOCUS_POLZA_TIMEOUT_MS=30000
FOCUS_POLZA_RETRY_ATTEMPTS=2
FOCUS_POLZA_RATE_LIMIT_PER_MINUTE=30
```

Compatibility aliases such as `POLZA_API_KEY` and `POLZA_MODEL` are accepted by the adapter for migration only. Prefer the `FOCUS_POLZA_*` names for production Focus configuration.

The production gate flags do not have compatibility aliases. If either `FOCUS_POLZA_PRODUCTION_ENABLED` or `FOCUS_POLZA_MODEL_COMPARISON_APPROVED` is absent or false, `FOCUS_GREETING_AI_PROVIDER=polza` resolves to the controlled disabled provider and no Polza request is made.

## Activation Steps

1. Deploy a source artifact that has passed the mock and fake-fetch Greeting Assistant checks.
2. Install or rotate `FOCUS_POLZA_API_KEY` only in the server secret store.
3. Set `FOCUS_POLZA_MODEL` to the selected model id from the completed comparison matrix. The approved comparison environment should capture sanitized runner output with `node scripts/greeting-model-comparison-runner.mjs run --provider=env --candidate=<safe candidate label> --out=output/greeting-model-comparison/<safe candidate label>.jsonl`.
4. Set `FOCUS_POLZA_PRODUCTION_ENABLED=true` and `FOCUS_POLZA_MODEL_COMPARISON_APPROVED=true` only after the owner approval and model comparison record are available.
5. Set conservative timeout, retry, and rate-limit values for the production envelope.
6. Restart only the Focus backend service after secrets are installed.
7. Verify `GET /api/health` returns `{"ok":true,"service":"focus-sync"}`.
8. Verify `GET /api/sync/greetings/status` through an authenticated Focus session returns `providerConfigured: true` and `provider: "polza"`.
9. Verify `GET /api/sync/greetings/readiness` returns `readinessStatus: "ready"` and `checks.liveProviderCallPerformed: false`.
10. Confirm the status and readiness responses do not include model id, API key, bearer token, base URL, provider metadata, draft fields, birthday mutations, reminder fields, delivery fields, or sent-status fields.
11. Run one approved live Greeting Assistant smoke from the Focus UI.
12. Record sanitized activation notes with `docs/specs/greeting-polza-production-smoke-report.md`: date, deployed source id, selected model id, provider status result, latency, cost estimate, and smoke pass/fail. Never record the key.

## Approved Live Smoke

Run only after owner approval and after secrets are installed on the server:

- open Greeting Assistant from a birthday record;
- generate three variants for a short birthday greeting;
- revise one variant with a warmer instruction;
- save the questionnaire draft from the UI;
- reopen and restore the saved draft;
- verify the generated text passed server validation;
- verify frontend network traffic uses only Focus backend greeting endpoints;
- verify `localStorage` contains no provider key, bearer token, model id, provider URL, or authorization-looking values.

The provider must not save drafts, copy text, edit birthdays, edit holidays, create reminders, send messages, or mark greetings as sent. Those actions remain Focus business logic after explicit user action.

## Rollback

If Polza activation fails or the provider becomes unavailable, do not switch production users to mock output. Use the controlled disabled state:

```text
FOCUS_GREETING_AI_PROVIDER=disabled
FOCUS_POLZA_PRODUCTION_ENABLED=false
FOCUS_POLZA_MODEL_COMPARISON_APPROVED=false
```

Then restart the backend and verify `/api/sync/greetings/status` returns `providerConfigured: false` with the unavailable message, and `/api/sync/greetings/readiness` returns `readinessStatus: "disabled"`. Users must still be able to save the questionnaire and continue later.

If the key may have been exposed, rotate it in Polza before any reactivation.

## Failure Triage

- `provider_not_configured`: missing provider, key, or model; verify only server secrets.
- `provider_http_401`: invalid or revoked key; rotate server secret.
- `provider_http_402`: account balance or billing problem; keep UI disabled until resolved.
- `provider_http_429` or local rate-limit waits: reduce traffic or rate-limit value.
- `provider_timeout`: raise timeout only after latency measurements justify it.
- `provider_validation_failed`: keep the provider disabled for production until the model/prompt result passes shared server validation.

Never expose raw provider error bodies or authorization headers to client responses.

## Required Checks

Run without real credentials and without live provider calls:

```text
npm run greeting:preflight
npm run test:greeting
npm run test:greeting:server
```

The preflight report must keep `liveProviderCallPerformed: false`, must not print key/model/base URL values, and must fail if `FOCUS_GREETING_AI_PROVIDER=polza` is selected without the required Polza gates or server-only key/model configuration.

The readiness smoke covers Polza disabled-without-gates, approved fake-fetch ready/generate/revise paths, and safe failed responses for approved provider failures without birthday or reminder changes.

Run the browser smoke in mock and disabled modes only until production activation is explicitly approved. The accepted local browser smoke covers:

- mock desktop flow from a birthday record with readiness `ready`, three generated variants, editable saved draft, and no provider/secrets markers in rendered DOM/HTML;
- disabled mobile `390x844` flow with readiness `disabled`, disabled generation button, save-draft still available, zero variants, and no horizontal overflow;
- loopback-only Focus backend and preview proxy, with artifacts under ignored `output/greeting-ui-smoke/` paths.

Use `docs/specs/greeting-polza-production-smoke-report.md` as the production-only reporting template after an approved live smoke.
