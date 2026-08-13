# Greeting Model Comparison Matrix

This document is the production-only evaluation plan for selecting the configured `FOCUS_POLZA_MODEL`.

Do not run this matrix in local development or CI. Run it only in an approved server environment where the Polza API key is stored in server secrets. All calls must go through Focus backend greeting endpoints, never directly from frontend or mobile clients.

## Candidate Setup

For each candidate model:

```text
FOCUS_GREETING_AI_PROVIDER=polza
FOCUS_POLZA_API_KEY=<server secret>
FOCUS_POLZA_MODEL=<candidate model id>
```

Keep the API key, model id, base URL, provider response metadata, and authorization-looking values out of client code, localStorage, screenshots, logs intended for users, and committed artifacts.

Initial low-cost ChatGPT candidate: `openai/gpt-4o-mini`. This is only a candidate for comparison and must not be hardcoded in UI, drafts, or Greeting Assistant business logic.

## Evaluation Flow

1. Select one candidate model id in server configuration.
2. Run every scenario in the matrix through Focus backend `/api/sync/greetings/generate`.
3. For revision-sensitive scenarios, also run `/api/sync/greetings/revise` with the listed revision instruction.
4. Store only sanitized outputs: scenario id, candidate model label, generated variants, validation result, latency, and estimated cost.
5. Reject a candidate immediately on secret leakage, profanity, malformed structured output, direct policy/contract violation, or repeated invented facts.
6. Compare surviving candidates by Russian quality, naturalness, compliance, latency, and cost.

## Scenario Matrix

| ID | Scenario | Required Input Shape | Special Checks |
| --- | --- | --- | --- |
| `birthday-short` | short birthday greeting | `scenario=birthday`, `length=short`, `variantCount=3` | concise, complete, three distinct variants |
| `birthday-personal` | personal greeting | `scenario=birthday`, `tone=personal`, personal note with allowed facts | uses only supplied personal facts |
| `official` | official greeting | `scenario=holiday`, `tone=official`, formal sender | formal tone, no casual language |
| `manager` | greeting to a manager | `recipient.role=руководитель`, `tone=respectful`, `addressMode=vy` | respectful, no overfamiliar phrasing |
| `team` | greeting from a team | `sender=коллектив`, `recipient.role=коллега` | sounds collective, no fake team details |
| `professional-holiday` | professional holiday | `holidayType=professional_holiday`, event title and description | profession context is used accurately |
| `public-holiday` | public holiday | `holidayType=public_holiday`, public/state event | balanced public tone, no political invention |
| `orthodox-holiday` | Orthodox holiday | `holidayType=religious_holiday`, `event.tradition=orthodox` | respectful religious wording |
| `catholic-holiday` | Catholic holiday | `holidayType=religious_holiday`, `event.tradition=catholic` | tradition is not mixed with Orthodox wording |
| `islamic-holiday` | Islamic holiday | `holidayType=religious_holiday`, `event.tradition=islamic` | respectful wording, no invented rituals |
| `light-humor` | light humor | `tone=light_humor`, safe relationship context | gentle humor, no sarcasm or insult |
| `no-age` | age mention forbidden | `scenario=birthday`, `bans.mentionAge=true`, birthday age present in context | no age number or age phrase |
| `no-personal-topic` | personal topic forbidden | `bans.personalTopics` contains a supplied sensitive topic | forbidden topic absent from all variants |
| `address-ty` | informal address | `addressMode=ty` | consistent informal address |
| `address-vy` | formal address | `addressMode=vy` | consistent formal address |

## Revision Checks

Run revision tests against at least these generated drafts:

| ID | Base Scenario | Revision Instruction | Required Outcome |
| --- | --- | --- | --- |
| `revision-warmer` | `birthday-personal` | `Сделай текст теплее.` | warmer wording without adding facts |
| `revision-official` | `manager` | `Сделай текст официальнее.` | more formal wording, same recipient/event |
| `revision-no-age` | `no-age` | `Сохрани запрет на упоминание возраста.` | no age mention after revision |
| `revision-no-topic` | `no-personal-topic` | `Не упоминай запрещенную личную тему.` | forbidden topic remains absent |

## Required Metrics

Record these metrics for every scenario and candidate:

- Russian language quality;
- naturalness;
- ban compliance;
- no invented facts;
- difference between three variants;
- no profanity;
- structured result validity;
- average latency;
- cost per request.

## Pass Gates

A candidate can be selected only if:

- all generated responses pass Focus server validation;
- all required scenarios produce 1 to 3 usable variants;
- all ban scenarios pass with no manual exceptions;
- no response includes secrets, model names, provider URLs, or authorization-looking text;
- no response performs or claims Focus business actions such as saving a draft, creating a reminder, sending a message, or marking a greeting as sent;
- average latency and cost per request are recorded for the final candidate.

## Decision Record Template

```text
Date:
Evaluator:
Approved environment:
Candidate model id:
Scenario set version: greeting-model-comparison@2026-08-13.v1

Pass/fail summary:
Average latency:
Cost per request:
Blocking failures:
Selected for production: yes/no
Notes:
```
