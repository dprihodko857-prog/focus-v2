import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { createFocusSyncClient } from "../public/js/sync.js";

const appJs = readFileSync("public/js/app.js", "utf8");
const syncJs = readFileSync("public/js/sync.js", "utf8");
const indexHtml = readFileSync("public/index.html", "utf8");

test("greeting client shell does not contain direct provider endpoints or env names", () => {
  const clientShell = [indexHtml, appJs, syncJs].join("\n");

  assert.doesNotMatch(
    clientShell,
    /FOCUS_GIGACHAT_|GIGACHAT_|GIGACHAT_AUTHORIZATION_KEY|GIGACHAT_MODEL|FOCUS_POLZA_|POLZA_|POLZA_API_KEY|POLZA_MODEL|api\.giga\.chat|ngw\.devices\.sberbank\.ru|polza\.ai\/api|sk-polza-|\/v1\/chat\/completions|\/api\/v2\/oauth/iu,
  );
  assert.doesNotMatch(
    clientShell,
    /localStorage\.setItem\([^)]*(?:GIGACHAT|POLZA|sk-polza|apiKey|access[_-]?token|authorizationKey|accessToken)/iu,
  );
});

test("greeting sync methods only call Focus backend and do not expose provider internals", () => {
  const syncGreetingBoundary = sliceBetween(
    syncJs,
    "async getGreetingStatus()",
    "async createSubscriptionCheckout",
  );

  assert.match(syncGreetingBoundary, /\/sync\/greetings\/status/);
  assert.match(syncGreetingBoundary, /\/sync\/greetings\/readiness/);
  assert.match(syncGreetingBoundary, /\/sync\/greetings\/generate/);
  assert.match(syncGreetingBoundary, /\/sync\/greetings\/revise/);
  assert.doesNotMatch(
    syncGreetingBoundary,
    /\b(?:providerModel|model|baseUrl|oauthUrl|apiKey|polzaApiKey|accessToken|authorizationKey|access_token)\b|GIGACHAT|POLZA|api\.giga\.chat|polza\.ai|chat\/completions/iu,
  );
});

test("greeting sync serializer allowlists request fields before sending JSON", () => {
  const serializerBoundary = sliceBetween(
    syncJs,
    "function serializeGreetingRequest",
    "function normalizeGreetingResult",
  );

  assert.match(serializerBoundary, /normalizeGreetingRequestBody/);
  assert.match(serializerBoundary, /normalizeGreetingGenerationRequest/);
  assert.match(serializerBoundary, /normalizeGreetingRequestContext/);
  assert.match(serializerBoundary, /promptVersion: GREETING_PROMPT_VERSION/);
  assert.doesNotMatch(serializerBoundary, /\.\.\.requestBody|\.\.\.source/);
  assert.doesNotMatch(
    serializerBoundary,
    /\b(?:providerModel|model|baseUrl|oauthUrl|apiKey|polzaApiKey|accessToken|authorizationKey|access_token)\b|GIGACHAT|POLZA/iu,
  );
});

test("greeting draft payload does not persist provider metadata", () => {
  const draftBoundary = sliceBetween(
    appJs,
    "function createGreetingAssistantDraftPayload",
    "async function copyGreetingAssistantText",
  );

  assert.match(draftBoundary, /normalizeGreetingDraftFields/);
  assert.match(draftBoundary, /normalizeGreetingDraftVariants/);
  assert.match(draftBoundary, /normalizeGreetingDraftInput/);
  assert.doesNotMatch(
    draftBoundary,
    /\b(?:providerConfigured|disabledMessage|providerModel|model|baseUrl|oauthUrl|apiKey|polzaApiKey|accessToken|authorizationKey|access_token|sentStatus|reminder|reminders)\b|provider:|GIGACHAT|POLZA/iu,
  );
});

test("greeting sync client strips provider-only fields from outbound request bodies", async () => {
  const requests = [];
  const client = createFocusSyncClient({
    apiBaseUrl: "/api",
    localStorage: createMemoryLocalStorage({
      "focus-sync-account-id": "account-client-boundary",
      "focus-sync-device-id": "device-client-boundary",
      "focus-sync-device-name": "Desktop",
    }),
    fetch: async (url, options = {}) => {
      requests.push({
        url,
        body: options.body ? JSON.parse(options.body) : null,
      });
      return jsonResponse(200, createGreetingSuccessResponse());
    },
  });

  await client.generateGreeting(createLeakyClientGreetingRequest());
  await client.reviseGreeting({
    sourceText: "Мария, поздравляю с днем рождения.",
    instruction: "Сделай теплее.",
    baseInput: createLeakyClientGreetingRequest(),
    accessToken: "client-access-token-secret",
    authorizationKey: "client-authorization-key-secret",
    apiKey: "client-polza-api-key-secret",
    polzaApiKey: "sk-polza-client-secret-with-enough-length",
    model: "client-model-secret",
    baseUrl: "https://client-gigachat-secret.test",
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, "/api/sync/greetings/generate");
  assert.equal(requests[1].url, "/api/sync/greetings/revise");
  requests.forEach(request => assertNoForbiddenGreetingClientKeys(request.body));
});

function sliceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `Missing boundary start: ${startNeedle}`);
  const end = source.indexOf(endNeedle, start);
  assert.notEqual(end, -1, `Missing boundary end: ${endNeedle}`);
  return source.slice(start, end);
}

function createMemoryLocalStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

function createGreetingSuccessResponse() {
  return {
    accountId: "account-client-boundary",
    status: "generated",
    provider: "mock",
    promptVersion: "greeting-assistant@2026-08-18.v3",
    variants: [{
      id: "one",
      title: "One",
      text: "Мария, поздравляю с днем рождения.",
      tone: "warm",
      format: "plain_text",
    }],
    safety: {
      validated: true,
      validationVersion: "greeting-result-validation@2026-08-06.v1",
    },
    warnings: [],
    checkedAt: "2026-08-06T09:05:00.000Z",
  };
}

function createLeakyClientGreetingRequest() {
  return {
    scenario: "birthday",
    recipient: {
      name: "Мария",
      role: "коллега",
      model: "client-recipient-model-secret",
    },
    event: {
      title: "День рождения",
      date: "2026-08-06",
      baseUrl: "https://client-event-secret.test",
    },
    context: {
      birthday: {
        name: "Мария",
        dateOfBirth: "1990-08-06",
        age: 36,
        note: "любит спокойные поздравления",
        accessToken: "client-birthday-token-secret",
      },
      personalNote: "без выдуманных фактов",
      allowedFacts: ["День рождения", "коллега"],
      oauthUrl: "https://client-oauth-secret.test",
    },
    bans: {
      mentionAge: true,
      personalTopics: [],
      authorizationKey: "client-ban-secret",
    },
    sender: "команда Focus",
    addressMode: "vy",
    tone: "warm",
    length: "medium",
    format: "plain_text",
    variantCount: 3,
    model: "client-model-secret",
    providerModel: "client-provider-model-secret",
    authorizationKey: "client-authorization-key-secret",
    accessToken: "client-access-token-secret",
    access_token: "client-access-token-secret",
    apiKey: "client-polza-api-key-secret",
    polzaApiKey: "sk-polza-client-secret-with-enough-length",
    baseUrl: "https://client-gigachat-secret.test",
    oauthUrl: "https://client-oauth-secret.test",
  };
}

function assertNoForbiddenGreetingClientKeys(payload) {
  const forbiddenKeys = new Set([
    "model",
    "providerModel",
    "apiKey",
    "polzaApiKey",
    "authorizationKey",
    "accessToken",
    "access_token",
    "baseUrl",
    "oauthUrl",
  ]);
  collectJsonKeys(payload).forEach(key => {
    assert.equal(forbiddenKeys.has(key), false, `Greeting client leaked forbidden key: ${key}`);
  });

  const serialized = JSON.stringify(payload);
  [
    "client-model-secret",
    "client-provider-model-secret",
    "client-polza-api-key-secret",
    "sk-polza-client-secret-with-enough-length",
    "client-authorization-key-secret",
    "client-access-token-secret",
    "https://client-gigachat-secret.test",
    "https://client-oauth-secret.test",
    "https://client-event-secret.test",
  ].forEach(secretValue => {
    assert.equal(serialized.includes(secretValue), false, `Greeting client leaked forbidden value: ${secretValue}`);
  });
}

function collectJsonKeys(value, keys = []) {
  if (Array.isArray(value)) {
    value.forEach(item => collectJsonKeys(item, keys));
    return keys;
  }
  if (!value || typeof value !== "object") return keys;
  Object.entries(value).forEach(([key, child]) => {
    keys.push(key);
    collectJsonKeys(child, keys);
  });
  return keys;
}
