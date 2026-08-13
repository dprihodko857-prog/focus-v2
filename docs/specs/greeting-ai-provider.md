# Greeting AI Provider

## Runtime scheme

Focus frontend and mobile clients must call only Focus backend endpoints:

```text
Focus frontend
-> Focus backend
-> GreetingAIProvider
-> provider API
-> server validation
-> Greeting Assistant UI
```

Clients do not receive provider credentials, access tokens, provider base URLs, or production model names. The provider cannot save drafts, copy text, modify birthdays, modify holidays, create reminders, send messages, or set a sent status. Those actions remain ordinary Focus business logic after an explicit user action.

## Contract

Runtime implementation lives in `server/greeting-ai-provider.mjs`; TypeScript boundaries are declared in `server/greeting-ai-provider.d.ts`.

```ts
interface GreetingAIProvider {
  generateGreeting(input: GreetingGenerationInput): Promise<GreetingGenerationResult>;
  reviseGreeting(input: GreetingRevisionInput): Promise<GreetingGenerationResult>;
}
```

Implemented adapters:

- `MockGreetingAIProvider` for development and tests.
- `DisabledGreetingAIProvider` for controlled unavailable state.
- `PolzaGreetingAIProvider` for the selected ChatGPT-over-Polza.ai production direction.
- `GigaChatGreetingAIProvider` remains available as a non-primary backend adapter for legacy rollout or comparison.

Future `YandexGreetingAIProvider` and `OpenAIGreetingAIProvider` adapters must implement the same contract. UI, draft models, and Greeting Assistant business logic must not change for a provider swap.

## Mock Release Checklist

The Greeting Assistant section is ready for the first mock-backed release when these items stay true:

- frontend and mobile clients call only Focus backend greeting endpoints;
- no provider key, access token, model name, base URL, or OAuth URL exists in client code, localStorage, or draft payloads;
- default development/runtime provider is `MockGreetingAIProvider` when no provider is configured;
- `DisabledGreetingAIProvider` shows the controlled unavailable state and still allows saving the questionnaire;
- `generateGreeting` and `reviseGreeting` use the shared `GreetingAIProvider` contract;
- generated and revised provider results pass shared server validation before they reach UI;
- Greeting Assistant UI enables generation and revision only after backend readiness reports safe generation availability;
- provider output cannot save drafts, copy text, edit birthdays/holidays, create reminders, send messages, or mark a greeting as sent;
- Greeting Assistant drafts persist only UI-safe form fields, variants, editor text, and normalized input context;
- browser smoke covers mock generation/revision/copy/save/reopen and mobile disabled state;
- static and fake-fetch client boundary tests stay green;
- server fake-fetch Polza and GigaChat tests stay green without live API calls.

Mock-release verification commands:

```text
node --test tests\greeting-client-boundary.test.mjs
node --test --test-name-pattern "app shell exposes server-side greeting assistant provider flow" tests\sync-integration-assets.test.mjs
node --test --test-name-pattern "sync greeting|Polza greeting provider|GigaChat greeting provider" tests\focus-sync-server.test.mjs
```

## Development Mode

Do not request or add real credentials during development. When `FOCUS_GREETING_AI_PROVIDER` is absent, Focus uses `MockGreetingAIProvider`, so the full UI flow works with mock results.

To force the disabled state:

```text
FOCUS_GREETING_AI_PROVIDER=disabled
```

The UI must show:

```text
Генерация поздравлений пока недоступна. Анкету можно сохранить и продолжить позднее.
```

## Local Smoke Verification

Last local smoke pass after the Polza production-direction switch: 2026-08-13.

Verified without credentials and without live provider calls:

- `FOCUS_GREETING_AI_PROVIDER=mock`: full Greeting Assistant flow from a birthday record, generate 3 variants, revise, copy, save draft, reopen, restore draft, and confirm localStorage has no provider credentials.
- `FOCUS_GREETING_AI_PROVIDER=disabled`: mobile controlled disabled state, generation button disabled, copy button disabled, questionnaire draft can still be saved, and localStorage has no provider credentials.
- `/api/sync/greetings/readiness`: mock mode returns `readinessStatus: "ready"` and disabled mode returns `readinessStatus: "disabled"` through Focus backend only, with no model id, API key, bearer token, base URL, provider metadata, or live provider call.
- Greeting Assistant modal uses backend readiness for its `data-readiness` UI state and generation/revision button gating.
- Browser smoke runner: `output/playwright/greeting-assistant-smoke.mjs` served local mock API responses on `127.0.0.1:8096`, used local Chrome, and made no live provider calls.
- Smoke screenshots:
  - `output/playwright/greeting-polza-mock-smoke.png`
  - `output/playwright/greeting-polza-disabled-smoke.png`
- Runtime resource checks confirmed the frontend did not call `polza.ai`, GigaChat hosts, `chat/completions`, or OAuth endpoints directly.

Smoke artifacts are written under ignored `output/playwright/` paths and must not be treated as production source.

## Server Fake-Fetch Coverage

`tests/focus-sync-server.test.mjs` covers `PolzaGreetingAIProvider` without live API calls:

- OpenAI-compatible `/chat/completions` payload shape;
- server-only bearer key use;
- model selection through server configuration;
- provider-not-configured state when key/model are absent;
- limited retry for transient chat failures;
- timeout mapped to a safe failed result;
- local rate limiting before chat calls;
- HTTP provider errors mapped to safe reasons;
- shared server validation rejecting invalid structured output.

Legacy `GigaChatGreetingAIProvider` fake-fetch coverage remains in place for token cache, token refresh, retry, timeout, rate limiting, HTTP error mapping, and validation.

## Production Polza.ai Setup

Use server-side environment variables or the existing server secrets mechanism. Never commit these values.
The committed `.env.example` lists the server-only variables with production values left commented or empty; do not place real keys there.

Required:

```text
FOCUS_GREETING_AI_PROVIDER=polza
FOCUS_POLZA_PRODUCTION_ENABLED=true
FOCUS_POLZA_MODEL_COMPARISON_APPROVED=true
FOCUS_POLZA_API_KEY=<server secret>
FOCUS_POLZA_MODEL=<model id selected by server configuration>
```

Optional:

```text
FOCUS_POLZA_BASE_URL=https://polza.ai/api/v1
FOCUS_POLZA_TIMEOUT_MS=30000
FOCUS_POLZA_RETRY_ATTEMPTS=2
FOCUS_POLZA_RATE_LIMIT_PER_MINUTE=30
```

Compatibility aliases are accepted for the initial rollout: `POLZA_API_KEY`, `POLZA_AI_API_KEY`, `POLZA_MODEL`, `POLZA_BASE_URL`, `POLZA_TIMEOUT`, `POLZA_TIMEOUT_MS`, `POLZA_RETRY_ATTEMPTS`, `POLZA_RATE_LIMIT_PER_MINUTE`.

For the separate model comparison environment only, `FOCUS_POLZA_MODEL_COMPARISON_EVALUATION_ENABLED=true` may enable Polza without the final production gates. Production activation still requires `FOCUS_POLZA_PRODUCTION_ENABLED=true` and `FOCUS_POLZA_MODEL_COMPARISON_APPROVED=true`.

Initial low-cost candidate for comparison: `openai/gpt-4o-mini`. Do not hardcode this candidate in UI, draft models, or Greeting Assistant business logic. The selected model must be provided only by server configuration.

Production activation checklist:

- Configure the Polza API key only in server secrets.
- Set the model name in server config, not in UI or business logic.
- Set `FOCUS_POLZA_PRODUCTION_ENABLED=true` only after owner approval for production activation.
- Set `FOCUS_POLZA_MODEL_COMPARISON_APPROVED=true` only after the comparison matrix is complete for the selected model.
- Verify `/api/sync/greetings/status` does not expose model, key, token, or provider URLs.
- Run server tests with fake provider calls; do not run live API calls in CI.
- Run a separate manual production smoke test only in an approved environment.

Production-only remaining work:

- select candidate Polza/OpenAI-compatible model ids through a separate quality/cost comparison;
- provision the real Polza API key in the server secrets mechanism, not in source code;
- configure `FOCUS_GREETING_AI_PROVIDER=polza`, `FOCUS_POLZA_MODEL`, `FOCUS_POLZA_PRODUCTION_ENABLED`, and `FOCUS_POLZA_MODEL_COMPARISON_APPROVED` only in the production server environment;
- confirm timeout, retry, and rate-limit values for the real deployment envelope;
- run the model comparison matrix in this document on an approved environment;
- record average latency and cost per request for the selected model;
- run one approved live production smoke after secrets are installed;
- keep live provider calls out of local development and CI.

Use `docs/specs/greeting-model-comparison.md` as the production-only comparison matrix and decision-record template.
Use `docs/specs/greeting-polza-production-runbook.md` for the separate production activation procedure after model selection and owner approval.

## Server Validation

Every provider result goes through the same server validation:

- structured status must be `generated`;
- 1 to 3 variants only;
- variant text must be non-empty and distinct;
- no profanity markers;
- no secret-looking markers;
- no age mention when `bans.mentionAge` is true;
- no forbidden personal topics;
- result is returned only after validation passes.

Provider failures return safe status/reason metadata without saving generated text.

## API Boundary

Greeting API responses are allowlisted by Focus backend. Provider-returned metadata is not forwarded to clients.

The `/api/sync/greetings/status`, `/readiness`, `/generate`, and `/revise` responses must not include:

- production model names;
- authorization keys or access tokens;
- provider base URLs or OAuth URLs;
- provider-side draft, birthday, reminder, delivery, or sent-status fields.

The authenticated `/api/sync/greetings/readiness` endpoint is a backend self-check. It reports only safe readiness facts: provider configured boolean, provider adapter name, prompt version, controlled disabled state, and invariant checks such as server validation required, backend-only provider access, no live provider call performed, no client model selection, and no provider side effects.

Provider output can only return generated text variants after server validation. Draft saving, copying, birthday edits, holiday edits, reminder creation, message sending, and sent status changes remain separate Focus business actions after explicit user input.

## Client Boundary

Focus frontend and mobile clients call only Focus backend greeting endpoints. The sync client allowlists outbound greeting request fields before JSON serialization, so provider-only fields such as model names, tokens, authorization keys, provider URLs, and OAuth URLs are not sent from the client even if they are accidentally present in a caller object.

Greeting Assistant UI reads `/api/sync/greetings/readiness` before generation controls become available. The UI treats missing, offline, unsafe, or disabled readiness as the controlled disabled state and still lets the user save the questionnaire draft.

Greeting drafts persist only UI-safe form fields, selected variants, editor text, and normalized input context. Provider availability state, disabled messages, provider metadata, model names, tokens, and URLs are not stored in Greeting Assistant drafts.

`tests/greeting-client-boundary.test.mjs` covers the static and fake-fetch client boundary.

## Model Comparison Before Production

Before enabling a production model, compare candidate Polza/OpenAI-compatible models on at least these scenarios:

- short birthday greeting;
- personal greeting;
- official greeting;
- greeting to a manager;
- greeting from a team;
- professional holiday;
- public holiday;
- Orthodox holiday;
- Catholic holiday;
- Islamic holiday;
- light humor;
- age mention forbidden;
- personal topic forbidden;
- informal `ты`;
- formal `вы`.

Measure:

- Russian language quality;
- naturalness;
- ban compliance;
- no invented facts;
- difference between three variants;
- no profanity;
- structured result validity;
- average latency;
- cost per request.

## Polza.ai API Notes

The selected production direction is ChatGPT through Polza.ai. Polza uses an OpenAI-compatible API: server calls `https://polza.ai/api/v1/chat/completions` with `Authorization: Bearer <server key>`, `model`, `messages`, `max_tokens`, `temperature`, and structured `response_format` when supported by the selected model. The adapter never exposes the API key, model, base URL, or provider response metadata to clients.

Official Polza references checked on 2026-08-13:

- https://polza.ai/blog/api-neyrosetei
- https://polza.ai/models/openai/gpt-4o-mini

## GigaChat Adapter Notes

The GigaChat adapter is no longer the selected production direction for Greeting Assistant. It remains available behind the same backend-only contract for legacy rollout or comparison. If enabled later, it follows the server-side OAuth/token flow documented by GigaChat: obtain an access token with an authorization key, cache it until expiry, and call chat completions with a bearer token. The adapter uses structured output and server validation before returning text to Focus UI.

Official docs to verify again before production activation:

- https://developers.sber.ru/docs/ru/gigachat/api/reference/rest/gigachat-api
- https://developers.sber.ru/docs/ru/gigachat/guides/structured-output
