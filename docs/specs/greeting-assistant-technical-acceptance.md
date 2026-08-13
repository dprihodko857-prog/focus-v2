# Greeting Assistant Technical Acceptance Snapshot

Status: accepted for mock-backed release and production-provider preparation. Polza.ai production traffic is not approved or activated by this document.

Date: 2026-08-13

Scope: Focus section "Compose greeting" only.

## Accepted Runtime Shape

Focus clients use only Focus backend endpoints:

```text
Focus frontend
-> Focus backend
-> GreetingAIProvider
-> provider API
-> server validation
-> Greeting Assistant UI
```

Accepted backend contract:

```ts
interface GreetingAIProvider {
  generateGreeting(input: GreetingGenerationInput): Promise<GreetingGenerationResult>;
  reviseGreeting(input: GreetingRevisionInput): Promise<GreetingGenerationResult>;
}
```

Accepted adapters:

- `MockGreetingAIProvider` for development, CI, and complete mock UI flow.
- `DisabledGreetingAIProvider` for controlled unavailable state.
- `PolzaGreetingAIProvider` for the selected ChatGPT-over-Polza.ai production direction.
- `GigaChatGreetingAIProvider` kept as a non-primary legacy/comparison adapter behind the same contract.

Future `YandexGreetingAIProvider` and `OpenAIGreetingAIProvider` can be added behind the same interface without changing Greeting Assistant UI, draft models, or business workflows.

## Accepted Server Behavior

- Provider selection is server-side only.
- Production model id is server configuration only.
- Polza production activation requires both `FOCUS_POLZA_PRODUCTION_ENABLED=true` and `FOCUS_POLZA_MODEL_COMPARISON_APPROVED=true`.
- Polza model-comparison environment can use `FOCUS_POLZA_MODEL_COMPARISON_EVALUATION_ENABLED=true` without production gates.
- Missing Polza gates resolve to controlled disabled state and make no external provider call.
- `/api/sync/greetings/status` and `/api/sync/greetings/readiness` expose only safe readiness facts.
- `/api/sync/greetings/generate` and `/api/sync/greetings/revise` run shared server request/result validation.
- Provider output cannot save drafts, copy text, edit birthdays, edit holidays, create reminders, send messages, or mark greetings as sent.
- Provider failures return safe failed/unavailable responses without raw provider bodies, authorization headers, provider URLs, model ids, or credentials.

## Accepted Client Boundary

- Frontend calls only Focus backend greeting endpoints.
- Frontend does not receive Polza/GigaChat keys, access tokens, base URLs, OAuth URLs, or production model ids.
- Frontend cannot select the production model.
- Greeting drafts persist only UI-safe form fields, variants, editor text, and normalized input context.
- Provider availability state, disabled messages, provider metadata, model ids, tokens, and URLs are not persisted in drafts or `localStorage`.
- If generation is unavailable, UI shows the controlled disabled state and still lets the user save the questionnaire.

Controlled disabled copy:

```text
Генерация поздравлений пока недоступна. Анкету можно сохранить и продолжить позднее.
```

## Accepted Test Coverage

Core contract and fake-fetch provider coverage:

```text
npm run test:greeting:server
```

Client and production boundary coverage:

```text
npm run greeting:preflight
npm run test:greeting
```

Model comparison runner coverage:

```text
npm run test:greeting
npm run greeting:comparison:mock
```

Accepted fake-fetch smoke coverage includes:

- production preflight for server-only Polza gates/configuration, frontend boundary markers, sanitized report output, and `liveProviderCallPerformed: false`;
- disabled Polza without production gates and no external fetch;
- approved fake-fetch Polza readiness `ready`;
- approved fake-fetch `/generate` and `/revise`;
- safe HTTP/rate-limit failure response;
- safe invalid structured output response;
- safe timeout response;
- unchanged birthday and reminder snapshots after provider failures.

Accepted local browser smoke evidence, run without credentials and without live provider calls:

- mock desktop flow from a birthday record: readiness `ready`, generation button enabled, three generated variants, editor draft saved, and no provider/secrets markers in rendered DOM/HTML;
- disabled mobile flow at `390x844`: readiness `disabled`, generation button disabled, questionnaire draft saved, zero variants, no horizontal overflow, and no provider/secrets markers in rendered DOM/HTML;
- loopback-only Focus backend and preview proxy were used; no Polza, GigaChat, chat completions, OAuth, bearer token, API key, model id, or provider base URL was exposed to the client.

Ignored smoke artifacts:

- `output/greeting-ui-smoke/greeting-mock-desktop.json`
- `output/greeting-ui-smoke/greeting-mock-desktop.png`
- `output/greeting-ui-smoke/greeting-disabled-mobile-390.json`
- `output/greeting-ui-smoke/greeting-disabled-mobile-390.png`

## Accepted Documentation Artifacts

- `docs/specs/greeting-ai-provider.md`: architecture, contract, adapters, server validation, client boundary, production setup.
- `docs/specs/greeting-model-comparison.md`: required model comparison matrix and decision-record template.
- `scripts/greeting-model-comparison-runner.mjs`: executable backend-only comparison runner.
- `scripts/greeting-production-preflight.mjs`: dry production configuration and client-boundary preflight with no provider call.
- `docs/specs/greeting-production-readiness-checklist.md`: final keyless readiness gate before any real provider key is installed.
- `docs/specs/greeting-polza-production-runbook.md`: full production activation runbook.
- `docs/specs/greeting-polza-operator-handoff.md`: short operator checklist.
- `docs/specs/greeting-polza-production-smoke-report.md`: sanitized live activation evidence template.

## Not Accepted For Live Production Yet

The following remain external production-activation tasks:

- run the model comparison matrix in an approved server-side environment with server secrets;
- select the final model by quality, latency, and cost;
- provision the real Polza API key only in the server secret mechanism;
- set production env flags only after owner approval and model comparison approval;
- run one approved live production smoke from Focus UI;
- record only sanitized activation evidence;
- rotate the provider key if it may have been exposed.

## Explicit Non-Goals

- No real Polza or GigaChat credentials are committed.
- No live provider calls are part of local development or CI.
- No client-side provider integration is accepted.
- No provider output can perform Focus business actions without explicit user action through existing Focus workflows.
