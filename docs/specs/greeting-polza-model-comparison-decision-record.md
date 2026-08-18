# Greeting Polza.ai Model Comparison Decision Record

Status: full live comparison recorded for prompt v3; candidate passed technical and manual gates, and production was activated after separate owner approval. No real key is included.

Date: 2026-08-18

Scope: Focus section "Compose greeting" only.

## Purpose

Use this record after an approved server-side model comparison run to decide whether a low-cost ChatGPT-over-Polza.ai candidate can become the configured `FOCUS_POLZA_MODEL`.

This record must contain only sanitized aggregate results. Do not paste API keys, bearer tokens, provider base URLs, raw provider request/response payloads, copied env-file contents, screenshots with secrets, or live JSONL output.

## Required Inputs

- Keyless readiness pass: `docs/specs/greeting-pre-key-readiness-report.md`.
- Server-secret handoff: `docs/specs/greeting-polza-server-secret-handoff.md`.
- Scenario matrix: `docs/specs/greeting-model-comparison.md`.
- Operator checklist: `docs/specs/greeting-polza-model-comparison-operator-checklist.md`.
- Operator brief: `docs/specs/greeting-polza-model-comparison-operator-brief.md`.
- Backend runner: `scripts/greeting-model-comparison-runner.mjs`.
- Scenario set version: `greeting-model-comparison@2026-08-13.v1`.

## Selected Production Candidate

Candidate that passed the full prompt v3 comparison and was activated server-side:

```text
openai/gpt-5.4-mini
```

Previous lower-cost candidates checked during tuning:

```text
openai/gpt-4o-mini
openai/gpt-4.1-mini
```

Prompt version under review:

```text
greeting-assistant@2026-08-18.v3
```

This is a production selection record. Before any future model change, the operator must verify that the candidate is still available through Polza.ai, that current pricing is acceptable, and that latency/cost measurements from an approved server-side run are recorded below.

The selected model id must stay in server configuration only. It must not be hardcoded in UI, drafts, mobile code, frontend assets, localStorage, business logic, tests, or committed runtime config.

## Approved Run Command

Run only in the approved server-side comparison environment after the key is installed in server secrets:

```text
node scripts/greeting-model-comparison-runner.mjs run --provider=env --candidate=<safe candidate label> --out=output/greeting-model-comparison/<safe candidate label>.jsonl
```

Do not commit live JSONL. Copy only sanitized aggregate facts into this record.

## Required Scenario Coverage

The run must cover every scenario and revision check from `docs/specs/greeting-model-comparison.md`:

- `birthday-short`
- `birthday-personal`
- `official`
- `manager`
- `team`
- `professional-holiday`
- `public-holiday`
- `orthodox-holiday`
- `catholic-holiday`
- `islamic-holiday`
- `light-humor`
- `no-age`
- `no-personal-topic`
- `address-ty`
- `address-vy`
- `revision-warmer`
- `revision-official`
- `revision-no-age`
- `revision-no-topic`

## Metric Scorecard

| Metric | Result | Notes |
| --- | --- | --- |
| Russian language quality | passed | Manual review found acceptable Russian for the first release after prompt v3 and model change. |
| Naturalness | passed | Texts are still restrained, but substantially less broken and more usable than lower-cost candidates. |
| Ban compliance | passed | Age, forbidden-topic, address-mode, and revision checks passed automated and manual review. |
| No invented facts | passed | No blocking unsupported facts were observed; generated text stayed close to supplied context and ordinary greeting wishes. |
| Difference between three variants | passed | Final run returned three variants for all 19 records; similarity guard found no duplicate suspects. |
| No profanity | passed | No profanity markers were found. |
| Structured result validity | passed | 19/19 records passed Focus server validation after strict schema, address-mode guard, validation retry, language-quality markers, and blocked-cliche markers. |
| Average latency | 2518 ms | Final run min 2194 ms, max 3551 ms. |
| Cost per request | 0.188099 RUB | Final run total estimate: 3.573885 RUB for 19 records, using verified Polza pricing for the candidate at run time. |

Note: prompt v3 plus `openai/gpt-5.4-mini` is the first candidate that passed the full technical and manual comparison gates. Production was activated only after separate owner approval and a server-only env change.

## Decision Fields

Fill only after review:

```text
Evaluator: Codex operator review
Approved environment: Focus server /opt/focus-v2 with server-only env file
Source commit id: e9f7231 plus 2026-08-18 runtime patches for OpenAI-compatible schema, strict variants, address-mode validation, usage cost preservation, validation retry, prompt v3 tuning, reduced temperature, language-quality markers, and blocked-cliche markers
Safe candidate label: polza-gpt-5-4-mini-prompt-v3-full-cliche-guard
Current Polza availability verified: yes
Current pricing verified: yes
Scenario set version: greeting-model-comparison@2026-08-13.v1
Generated records count: 15
Revision records count: 4
Server validation failures: 0
Manual metric failures: 0
Average latency: 2518 ms
Cost per request: 0.188099 RUB
Selected for production: yes
Approval reference: owner explicitly approved production activation in Codex on 2026-08-18 for Polza `openai/gpt-5.4-mini`
Rollback owner: Focus server operator
Notes: Final sanitized JSONL remains server-side under ignored output/greeting-model-comparison/polza-gpt-5-4-mini-prompt-v3-full-cliche-guard.jsonl. Server-only env backup before activation: /opt/focus-v2/deploy-backups/focus-v2-env-pre-polza-production-20260818-145802.env. Production preflight passed after service restart; one backend smoke generation returned 3 server-validated variants without exposing text or provider secrets. Production UI smoke from Greeting Assistant passed generation, revision, save-draft, boundary, service, and cleanup checks; sanitized evidence is recorded in docs/specs/greeting-polza-production-smoke-report.md. Do not commit live JSONL.
```

## Approval Gate

The candidate can be selected only if all of these are true:

- all scenario and revision records exist;
- all generated and revised results pass Focus server validation;
- all ban scenarios pass without manual exceptions;
- three variants are meaningfully different where three variants are requested;
- no generated text includes secrets, model names, provider URLs, bearer tokens, authorization-looking values, or raw provider metadata;
- no generated text performs or claims Focus business actions such as saving a draft, creating a reminder, sending a message, copying text, editing birthday data, editing holiday data, or marking a greeting as sent;
- Russian-language quality and naturalness are acceptable for the first Russian-language release;
- current availability and pricing are verified before approval;
- average latency and cost per request are recorded;
- owner approval is recorded;
- `FOCUS_POLZA_MODEL_COMPARISON_APPROVED=true` is set only after this record is complete and approved.

## Current Decision

```text
Selected for production: yes
Reason: prompt v3 with `openai/gpt-5.4-mini` passed the full technical and manual comparison gates; owner approved production activation; server-only env was updated; production preflight, backend smoke, and production UI smoke passed.
```
