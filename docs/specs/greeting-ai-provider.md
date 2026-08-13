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
- `GigaChatGreetingAIProvider` for the first Russian production release.

Future `YandexGreetingAIProvider` and `OpenAIGreetingAIProvider` adapters must implement the same contract. UI, draft models, and Greeting Assistant business logic must not change for a provider swap.

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

Last local smoke pass: 2026-08-13.

Verified without credentials and without live provider calls:

- `FOCUS_GREETING_AI_PROVIDER=mock`: full Greeting Assistant flow from a birthday record, generate 3 variants, revise, copy, save draft, reopen, restore draft, and confirm localStorage has no provider credentials.
- `FOCUS_GREETING_AI_PROVIDER=disabled`: mobile controlled disabled state, generation button disabled, copy button disabled, questionnaire draft can still be saved, and localStorage has no provider credentials.

Smoke artifacts are written under ignored `output/playwright/` paths and must not be treated as production source.

## Server Fake-Fetch Coverage

`tests/focus-sync-server.test.mjs` covers `GigaChatGreetingAIProvider` without live API calls:

- server token cache and structured chat payload;
- token refresh after 401/403 provider auth failure;
- limited retry for transient chat failures;
- timeout mapped to a safe failed result;
- local rate limiting before chat calls;
- HTTP provider errors mapped to safe reasons;
- shared server validation rejecting invalid structured output.

## Production GigaChat Setup

Use server-side environment variables or the existing server secrets mechanism. Never commit these values.

Required:

```text
FOCUS_GREETING_AI_PROVIDER=gigachat
FOCUS_GIGACHAT_AUTHORIZATION_KEY=<authorization key>
FOCUS_GIGACHAT_MODEL=<model name selected by server configuration>
```

Optional:

```text
FOCUS_GIGACHAT_SCOPE=GIGACHAT_API_PERS
FOCUS_GIGACHAT_BASE_URL=https://api.giga.chat
FOCUS_GIGACHAT_OAUTH_URL=https://ngw.devices.sberbank.ru:9443/api/v2/oauth
FOCUS_GIGACHAT_TIMEOUT_MS=30000
FOCUS_GIGACHAT_RETRY_ATTEMPTS=2
FOCUS_GIGACHAT_RATE_LIMIT_PER_MINUTE=30
```

Compatibility aliases are accepted for the initial rollout: `GIGACHAT_AUTHORIZATION_KEY`, `GIGACHAT_SCOPE`, `GIGACHAT_MODEL`, `GIGACHAT_BASE_URL`, `GIGACHAT_TIMEOUT`, `GIGACHAT_TIMEOUT_MS`.

Production activation checklist:

- Configure the authorization key only in server secrets.
- Set the model name in server config, not in UI or business logic.
- Verify `/api/sync/greetings/status` does not expose model, token, key, or provider URLs.
- Run server tests with fake provider calls; do not run live API calls in CI.
- Run a separate manual production smoke test only in an approved environment.

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

The `/api/sync/greetings/status`, `/generate`, and `/revise` responses must not include:

- production model names;
- authorization keys or access tokens;
- provider base URLs or OAuth URLs;
- provider-side draft, birthday, reminder, delivery, or sent-status fields.

Provider output can only return generated text variants after server validation. Draft saving, copying, birthday edits, holiday edits, reminder creation, message sending, and sent status changes remain separate Focus business actions after explicit user input.

## Client Boundary

Focus frontend and mobile clients call only Focus backend greeting endpoints. The sync client allowlists outbound greeting request fields before JSON serialization, so provider-only fields such as model names, tokens, authorization keys, provider URLs, and OAuth URLs are not sent from the client even if they are accidentally present in a caller object.

Greeting drafts persist only UI-safe form fields, selected variants, editor text, and normalized input context. Provider availability state, disabled messages, provider metadata, model names, tokens, and URLs are not stored in Greeting Assistant drafts.

`tests/greeting-client-boundary.test.mjs` covers the static and fake-fetch client boundary.

## Model Comparison Before Production

Before enabling a production model, compare candidate GigaChat models on at least these scenarios:

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

## GigaChat API Notes

The production adapter follows the server-side OAuth/token flow documented by GigaChat: obtain an access token with an authorization key, cache it until expiry, and call chat completions with a bearer token. The adapter uses structured output and server validation before returning text to Focus UI.

Official docs to verify again before production activation:

- https://developers.sber.ru/docs/ru/gigachat/api/reference/rest/gigachat-api
- https://developers.sber.ru/docs/ru/gigachat/guides/structured-output
