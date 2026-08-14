# Greeting Polza.ai Model Comparison Operator Checklist

Status: operator checklist for an approved server-side model comparison run. This document does not contain a real key, does not approve production activation, and must not be used from local development, CI, frontend, or mobile clients.

Date: 2026-08-14

Scope: Focus section "Compose greeting" only.

## Preconditions

- Owner approval exists for a model-comparison run, not production activation.
- `docs/specs/greeting-pre-key-readiness-report.md` records a passed keyless readiness gate.
- `docs/specs/greeting-polza-server-secret-handoff.md` has been followed for server-only secret installation.
- `docs/specs/greeting-model-comparison.md` is the scenario matrix for the run.
- `docs/specs/greeting-polza-model-comparison-decision-record.md` is ready to receive sanitized aggregate results.
- The operator has shell access only to the approved server-side comparison environment.

Do not proceed if the key would need to be pasted into chat, committed files, screenshots, `.env.example`, frontend code, mobile code, localStorage, issue comments, or shared logs.

## Server-Only Comparison Configuration

The comparison environment must use only the model-comparison gate:

```text
FOCUS_GREETING_AI_PROVIDER=polza
FOCUS_POLZA_MODEL_COMPARISON_EVALUATION_ENABLED=true
FOCUS_POLZA_API_KEY=<server secret installed outside chat>
FOCUS_POLZA_MODEL=<candidate model id selected by server configuration>
```

The comparison environment must not set production activation gates:

```text
FOCUS_POLZA_PRODUCTION_ENABLED=false
FOCUS_POLZA_MODEL_COMPARISON_APPROVED=false
```

`FOCUS_POLZA_MODEL_COMPARISON_APPROVED=true` is allowed only after `docs/specs/greeting-polza-model-comparison-decision-record.md` is complete and approved.

## Dry Preflight

Run before the comparison call:

```text
npm run greeting:preflight -- --env-file <server-only env file path>
```

Expected safe facts:

- `status: "passed"`;
- `requestedProvider: "polza"`;
- `effectiveProvider: "polza"`;
- `activationMode: "model_comparison"`;
- `providerConfigured: true`;
- `productionActivationReady: false`;
- `liveProviderCallPerformed: false`;
- `clientBoundary.passed: true`;
- output does not print API key, selected model id, provider base URL, bearer token, authorization header, or raw provider metadata.

Stop if dry preflight fails.

## Run Commands

Confirm the runner scenario set:

```text
node scripts/greeting-model-comparison-runner.mjs summary
```

Run the approved candidate through the backend-only runner:

```text
node scripts/greeting-model-comparison-runner.mjs run --provider=env --candidate=<safe candidate label> --out=output/greeting-model-comparison/<safe candidate label>.jsonl
```

The safe candidate label must not be an API key, bearer token, copied env value, provider URL, or raw model configuration if the output path may be shared outside operators.

Do not run this from frontend or mobile clients. Do not call Polza directly from browser tooling.

## Required Output Review

Review the generated JSONL only in the approved operator environment.

The operator must confirm:

- generated records count matches all 15 generation scenarios;
- revision records count matches all 4 revision checks;
- scenario set version is `greeting-model-comparison@2026-08-13.v1`;
- all records pass Focus server validation;
- all ban scenarios pass with no manual exception;
- no output contains API keys, bearer tokens, provider base URLs, provider metadata, raw request/response bodies, model ids, or authorization-looking text;
- no output claims to save drafts, copy text, edit birthdays, edit holidays, create reminders, send messages, or mark a greeting as sent;
- average latency and cost per request can be calculated from sanitized data.

## Manual Metric Review

Fill the scorecard in `docs/specs/greeting-polza-model-comparison-decision-record.md` with sanitized aggregate results:

- Russian language quality;
- naturalness;
- ban compliance;
- no invented facts;
- difference between three variants;
- no profanity;
- structured result validity;
- average latency;
- cost per request.

Do not copy live JSONL, raw provider responses, prompt payloads, keys, tokens, provider URLs, or env-file contents into the decision record.

## After The Run

- Keep live JSONL under ignored `output/greeting-model-comparison/` paths.
- Copy only aggregate pass/fail, latency, cost, and manual metric notes into `docs/specs/greeting-polza-model-comparison-decision-record.md`.
- Leave `Selected for production: no` until the owner approves the completed decision record.
- Keep `FOCUS_POLZA_PRODUCTION_ENABLED=false` and `FOCUS_POLZA_MODEL_COMPARISON_APPROVED=false` until production activation is separately approved.
- If no further comparison is needed, disable the comparison environment or remove the evaluation gate.

## Stop Conditions

Stop and do not approve the candidate if:

- any scenario or revision record is missing;
- any Focus server validation fails;
- any required ban is violated;
- profanity appears;
- generated text invents facts outside supplied context;
- generated variants are effectively duplicates where three variants are requested;
- generated text leaks secrets, provider metadata, provider URLs, authorization-looking values, or model ids;
- generated text claims Focus business actions happened without explicit user action;
- average latency or cost per request cannot be recorded;
- current Polza availability or pricing cannot be verified.

## Rollback

If the comparison setup is unsafe or the key may have been exposed, rotate the key before any rerun.

For the comparison environment, return to the controlled disabled state:

```text
FOCUS_GREETING_AI_PROVIDER=disabled
FOCUS_POLZA_MODEL_COMPARISON_EVALUATION_ENABLED=false
FOCUS_POLZA_PRODUCTION_ENABLED=false
FOCUS_POLZA_MODEL_COMPARISON_APPROVED=false
```

Then run:

```text
npm run greeting:preflight -- --env-file <server-only env file path>
```

Expected safe result: `effectiveProvider: "disabled"` or a mock/default provider in non-comparison environments, `productionActivationReady: false`, and `liveProviderCallPerformed: false`.
