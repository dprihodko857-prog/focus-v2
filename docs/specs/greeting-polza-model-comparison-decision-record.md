# Greeting Polza.ai Model Comparison Decision Record

Status: decision-record template only. No production model is selected by this document, no real key is included, and no live provider call is approved by this document.

Date: 2026-08-14

Scope: Focus section "Compose greeting" only.

## Purpose

Use this record after an approved server-side model comparison run to decide whether a low-cost ChatGPT-over-Polza.ai candidate can become the configured `FOCUS_POLZA_MODEL`.

This record must contain only sanitized aggregate results. Do not paste API keys, bearer tokens, provider base URLs, raw provider request/response payloads, copied env-file contents, screenshots with secrets, or live JSONL output.

## Required Inputs

- Keyless readiness pass: `docs/specs/greeting-pre-key-readiness-report.md`.
- Server-secret handoff: `docs/specs/greeting-polza-server-secret-handoff.md`.
- Scenario matrix: `docs/specs/greeting-model-comparison.md`.
- Backend runner: `scripts/greeting-model-comparison-runner.mjs`.
- Scenario set version: `greeting-model-comparison@2026-08-13.v1`.

## Candidate Under Review

Initial low-cost ChatGPT candidate to evaluate:

```text
openai/gpt-4o-mini
```

This is not a production selection. Before approval, the operator must verify that the candidate is still available through Polza.ai, that current pricing is acceptable, and that latency/cost measurements from the approved server-side run are recorded below.

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

Fill after the approved comparison run:

| Metric | Result | Notes |
| --- | --- | --- |
| Russian language quality | pending |  |
| Naturalness | pending |  |
| Ban compliance | pending |  |
| No invented facts | pending |  |
| Difference between three variants | pending |  |
| No profanity | pending |  |
| Structured result validity | pending |  |
| Average latency | pending |  |
| Cost per request | pending |  |

## Decision Fields

Fill only after review:

```text
Evaluator:
Approved environment:
Source commit id:
Safe candidate label:
Current Polza availability verified: yes/no
Current pricing verified: yes/no
Scenario set version:
Generated records count:
Revision records count:
Server validation failures:
Manual metric failures:
Average latency:
Cost per request:
Selected for production: no
Approval reference:
Rollback owner:
Notes:
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
- `FOCUS_POLZA_MODEL_COMPARISON_APPROVED=true` is not set before this record is complete and approved.

## Current Decision

```text
Selected for production: no
Reason: no approved live comparison run has been recorded yet.
```
