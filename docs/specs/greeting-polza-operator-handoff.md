# Greeting Polza.ai Operator Handoff

Status: operator checklist only. This document does not approve live provider calls, secret installation, deployment, or production activation by itself.

Scope: Focus Greeting Assistant only.

## Before Touching Secrets

- Confirm owner approval for model comparison or production activation.
- Keep local development and CI on `FOCUS_GREETING_AI_PROVIDER=mock` or `FOCUS_GREETING_AI_PROVIDER=disabled`.
- Do not paste API keys into chat, shell history, screenshots, docs, `.env.example`, frontend code, mobile code, or git.
- Do not expose model ids, provider base URLs, bearer tokens, or provider metadata to clients.
- Use `docs/specs/greeting-production-readiness-checklist.md` as the final keyless readiness gate before asking anyone to install a real provider key.
- Use `docs/specs/greeting-polza-server-secret-handoff.md` for the separate server-secret installation handoff; it must not contain the real provider key.
- Use `docs/specs/greeting-polza-production-runbook.md` for full context and `docs/specs/greeting-polza-production-smoke-report.md` for the final activation record.

## 1. Model Comparison Environment

Use a separate approved server-side comparison environment. Do not send public production traffic through this gate.

```text
FOCUS_GREETING_AI_PROVIDER=polza
FOCUS_POLZA_MODEL_COMPARISON_EVALUATION_ENABLED=true
FOCUS_POLZA_API_KEY=<server secret>
FOCUS_POLZA_MODEL=<candidate model id>
```

Run the executable matrix and save only sanitized JSONL under ignored `output/` paths:

```text
node scripts/greeting-model-comparison-runner.mjs summary
node scripts/greeting-model-comparison-runner.mjs run --provider=env --candidate=<safe candidate label> --out=output/greeting-model-comparison/<safe candidate label>.jsonl
```

Do not commit live JSONL. Copy only sanitized aggregate latency, cost, pass/fail, and selected model notes into the decision record in `docs/specs/greeting-model-comparison.md`.

## 2. Pre-Activation Checks

Run without real credentials and without live provider calls:

```text
npm run greeting:preflight
npm run test:greeting
npm run test:greeting:server
```

Expected coverage:

- Production preflight checks server-only gates/configuration, frontend boundary markers, and `liveProviderCallPerformed: false`.
- Polza stays disabled when production gates are missing.
- Approved fake-fetch Polza path reports readiness `ready`.
- Fake-fetch `/generate` and `/revise` pass server validation.
- Provider failure, timeout, and malformed output return safe failed responses.
- Birthday and reminder data are unchanged by provider output or provider failures.
- Frontend assets contain no provider keys, model ids, provider URLs, bearer tokens, or Polza/GigaChat endpoints.
- Local browser smoke covers mock desktop generation from a birthday record and disabled mobile `390x844` save-draft flow, using only loopback Focus backend routes and ignored `output/greeting-ui-smoke/` artifacts.

## 3. Production Activation

Set these values only in the production server secret/config mechanism:

```text
FOCUS_GREETING_AI_PROVIDER=polza
FOCUS_POLZA_PRODUCTION_ENABLED=true
FOCUS_POLZA_MODEL_COMPARISON_APPROVED=true
FOCUS_POLZA_API_KEY=<server secret>
FOCUS_POLZA_MODEL=<selected model id>
```

For the current systemd deployment, `server/focus-v2-sync.service` reads server-only values through `EnvironmentFile=-/opt/focus-v2/data/focus-v2.env`. Put secret values in the deployment secrets vault or that server-only env file, not in the committed unit file.

Optional production values:

```text
FOCUS_POLZA_BASE_URL=https://polza.ai/api/v1
FOCUS_POLZA_TIMEOUT_MS=30000
FOCUS_POLZA_RETRY_ATTEMPTS=2
FOCUS_POLZA_RATE_LIMIT_PER_MINUTE=30
```

Restart only the Focus backend after secrets are installed.

## 4. Server Verification

Verify through an authenticated Focus session:

```text
GET /api/health
GET /api/sync/greetings/status
GET /api/sync/greetings/readiness
```

Expected safe facts:

- `/api/health` returns `{"ok":true,"service":"focus-sync"}`.
- `/api/sync/greetings/status` returns `providerConfigured: true` and `provider: "polza"`.
- `/api/sync/greetings/readiness` returns `readinessStatus: "ready"` and `checks.liveProviderCallPerformed: false`.
- Status/readiness responses do not include selected model id, API key, bearer token, base URL, provider raw body, birthday mutations, reminder mutations, delivery fields, draft fields, or sent-status fields.

## 5. Approved Live Smoke

Run only after owner approval and after server secrets are installed:

- open Greeting Assistant from a birthday record;
- generate three variants;
- revise one variant;
- save the questionnaire draft;
- reopen and restore the saved draft;
- confirm generated and revised text passed server validation;
- confirm browser traffic uses only Focus backend greeting endpoints;
- confirm `localStorage` contains no key, token, model id, provider URL, or authorization-looking values.

Record sanitized evidence in `docs/specs/greeting-polza-production-smoke-report.md`. Never record or paste the key.

## 6. Rollback

If activation fails, disable production provider access:

```text
FOCUS_GREETING_AI_PROVIDER=disabled
FOCUS_POLZA_PRODUCTION_ENABLED=false
FOCUS_POLZA_MODEL_COMPARISON_APPROVED=false
```

Restart the backend and verify:

- `/api/sync/greetings/status` returns `providerConfigured: false`;
- `/api/sync/greetings/readiness` returns `readinessStatus: "disabled"`;
- UI shows the controlled disabled state and still allows saving the questionnaire.

If a key may have been exposed, rotate it in Polza before any reactivation.
