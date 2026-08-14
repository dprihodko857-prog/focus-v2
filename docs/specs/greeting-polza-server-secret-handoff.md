# Greeting Polza.ai Server Secret Handoff

Status: server-secret handoff template only. This document does not contain a real key and does not approve live provider calls, production activation, deployment, or model selection by itself.

Date: 2026-08-14

Scope: Focus section "Compose greeting" only.

## Purpose

Use this document when the owner is ready to move from keyless readiness into a separate model-comparison or production-secret installation workflow.

The provider key must never be pasted into Codex chat, committed files, screenshots, docs, frontend code, mobile code, localStorage, shell history, or issue comments.

## Required Preconditions

- `docs/specs/greeting-pre-key-readiness-report.md` exists and records a passed keyless readiness gate.
- `npm run greeting:preflight`, `npm run test:greeting`, and `npm run test:greeting:server` pass without real credentials.
- Owner explicitly approves either model-comparison secret installation or production secret installation.
- The selected model id is chosen through the server-side model comparison workflow before production activation.
- The operator has access to the deployment secret store or the server-only env file referenced by `server/focus-v2-sync.service`.

## Allowed Secret Destination

Preferred destination: deployment Secrets Vault.

Current systemd fallback destination:

```text
/opt/focus-v2/data/focus-v2.env
```

The committed service file must keep only:

```text
EnvironmentFile=-/opt/focus-v2/data/focus-v2.env
```

Do not put real provider values in `server/focus-v2-sync.service`, `.env.example`, repository docs, local browser storage, client assets, mobile assets, or tests.

## Model Comparison Secret Set

Use only in a separate approved server-side comparison environment:

```text
FOCUS_GREETING_AI_PROVIDER=polza
FOCUS_POLZA_MODEL_COMPARISON_EVALUATION_ENABLED=true
FOCUS_POLZA_API_KEY=<server secret installed outside chat>
FOCUS_POLZA_MODEL=<candidate model id selected by server configuration>
```

Do not set production gates for comparison-only traffic.

Run model comparison only from the server-side environment:

```text
node scripts/greeting-model-comparison-runner.mjs summary
node scripts/greeting-model-comparison-runner.mjs run --provider=env --candidate=<safe candidate label> --out=output/greeting-model-comparison/<safe candidate label>.jsonl
```

Use `docs/specs/greeting-model-comparison.md` for the required scenario matrix and `docs/specs/greeting-polza-model-comparison-operator-checklist.md` for the approved operator run order.
Do not commit live JSONL. Record only sanitized aggregate quality, latency, cost, and decision notes in `docs/specs/greeting-polza-model-comparison-decision-record.md`.

## Production Secret Set

Use only after owner approval, completed model comparison, and approved production activation:

```text
FOCUS_GREETING_AI_PROVIDER=polza
FOCUS_POLZA_PRODUCTION_ENABLED=true
FOCUS_POLZA_MODEL_COMPARISON_APPROVED=true
FOCUS_POLZA_API_KEY=<server secret installed outside chat>
FOCUS_POLZA_MODEL=<selected model id selected by server configuration>
FOCUS_POLZA_TIMEOUT_MS=30000
FOCUS_POLZA_RETRY_ATTEMPTS=2
FOCUS_POLZA_RATE_LIMIT_PER_MINUTE=30
```

`FOCUS_POLZA_BASE_URL` can stay on the adapter default unless the operator has an approved reason to override it.

## Dry Verification After Secret Installation

Before any live UI smoke, run a dry server-side preflight against the server-only env source:

```text
npm run greeting:preflight -- --env-file <server-only env file path>
```

Expected safe facts:

- `status: "passed"`;
- `liveProviderCallPerformed: false`;
- `requestedProvider: "polza"`;
- `effectiveProvider: "polza"` only when the relevant comparison or production gate is set;
- `providerConfigured: true`;
- `clientBoundary.passed: true`;
- the output does not print API key, model id, provider base URL, bearer token, authorization header, or raw provider metadata.

If this dry preflight fails, do not run model comparison or live smoke until the server-only configuration is corrected.

## Handoff Record Fields

Record only safe operational fields:

- owner approval reference;
- target environment;
- secret destination type, for example Secrets Vault or server-only env file;
- selected workflow: model comparison or production activation;
- selected model decision reference, not the model value if the record can be shown outside operators;
- source commit id;
- dry preflight result summary;
- rollback owner;
- key rotation owner.

Do not record the key, bearer token, authorization header, raw provider response, provider request headers, provider base URL override, or copied env-file contents.

## Rollback

If installation or activation fails, set the provider to the controlled disabled state through server-only configuration:

```text
FOCUS_GREETING_AI_PROVIDER=disabled
FOCUS_POLZA_PRODUCTION_ENABLED=false
FOCUS_POLZA_MODEL_COMPARISON_APPROVED=false
```

Then restart only the Focus backend and verify `/api/sync/greetings/readiness` returns `readinessStatus: "disabled"`. Users must still be able to save the greeting questionnaire and continue later.

If a key may have been exposed anywhere outside the server secret mechanism, rotate it before any reactivation.
