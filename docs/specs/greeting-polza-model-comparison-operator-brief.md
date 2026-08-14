# Greeting Polza.ai Model Comparison Operator Brief

Status: copy/paste-safe operator brief. This document does not contain a real key, does not approve production activation, and must not be used from local development, CI, frontend, or mobile clients.

Date: 2026-08-14

Scope: Focus section "Compose greeting" only.

Use this brief with:

- `docs/specs/greeting-polza-model-comparison-operator-checklist.md`
- `docs/specs/greeting-polza-model-comparison-decision-record.md`
- `docs/specs/greeting-polza-server-secret-handoff.md`

## Message To Operator

```text
Please run the Focus Greeting Assistant Polza.ai model-comparison check in the approved server-side comparison environment only.

Do not paste, print, screenshot, commit, or send the provider key, bearer token, copied env-file contents, provider URL override, raw request, raw response, prompt payload, or live JSONL output.

Server-side comparison configuration must already be installed through the approved secret mechanism:

FOCUS_GREETING_AI_PROVIDER=polza
FOCUS_POLZA_MODEL_COMPARISON_EVALUATION_ENABLED=true
FOCUS_POLZA_PRODUCTION_ENABLED=false
FOCUS_POLZA_MODEL_COMPARISON_APPROVED=false
FOCUS_POLZA_API_KEY installed only in server secrets
FOCUS_POLZA_MODEL installed only in server configuration

Before the comparison call, run:

npm run greeting:preflight -- --env-file <server-only env file path>

Expected preflight facts:

status: "passed"
requestedProvider: "polza"
effectiveProvider: "polza"
activationMode: "model_comparison"
providerConfigured: true
productionActivationReady: false
liveProviderCallPerformed: false
clientBoundary.passed: true

If preflight fails or prints secret/model/provider URL values, stop.

Confirm the scenario set:

node scripts/greeting-model-comparison-runner.mjs summary

Run the candidate:

node scripts/greeting-model-comparison-runner.mjs run --provider=env --candidate=<safe candidate label> --out=output/greeting-model-comparison/<safe candidate label>.jsonl

Keep the live JSONL only in the ignored output path. Do not commit or send it.

Return only these sanitized facts:

source commit id
safe candidate label
scenario set version
generated records count
revision records count
server validation failures
manual metric failures
average latency
cost per request
current Polza availability verified: yes/no
current pricing verified: yes/no
blocking failures
short notes for docs/specs/greeting-polza-model-comparison-decision-record.md

Do not set FOCUS_POLZA_MODEL_COMPARISON_APPROVED=true.
Do not set FOCUS_POLZA_PRODUCTION_ENABLED=true.
Do not run a production live smoke.
```

## Stop Conditions

Tell the operator to stop immediately if:

- the key would need to be pasted into chat, docs, shell output, screenshots, frontend code, mobile code, `.env.example`, or git;
- `npm run greeting:preflight -- --env-file <server-only env file path>` fails;
- preflight performs a live provider call;
- preflight reports `productionActivationReady: true` during comparison-only work;
- any output includes a key, bearer token, provider URL, raw provider metadata, copied env value, or authorization-looking text;
- the runner cannot cover all 15 generation scenarios and 4 revision checks;
- average latency or cost per request cannot be calculated.

## Safe Return Format

```text
Source commit id:
Safe candidate label:
Scenario set version:
Generated records count:
Revision records count:
Server validation failures:
Manual metric failures:
Average latency:
Cost per request:
Current Polza availability verified: yes/no
Current pricing verified: yes/no
Blocking failures:
Decision-record notes:
```

The return message must not include the API key, bearer token, model id if it is not safe to disclose, provider base URL, raw JSONL, raw provider response, prompt payload, env-file contents, or screenshots with secrets.
