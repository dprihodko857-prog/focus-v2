import assert from "node:assert/strict";
import { test } from "node:test";

import { createFocusSyncClient } from "../public/js/sync.js";

test("greeting readiness client loads safe diagnostics and strips provider internals", async () => {
  const calls = [];
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "account-greeting-readiness",
    "focus-sync-device-id": "device-greeting-readiness",
  });
  const client = createFocusSyncClient({
    apiBaseUrl: "/api",
    localStorage: storage,
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      return jsonResponse({
        accountId: "account-greeting-readiness",
        featureKey: "greetingAssistant",
        providerConfigured: true,
        provider: "polza",
        providerModel: "client-must-not-see-model",
        model: "client-must-not-see-model",
        apiKey: "sk-polza-client-must-not-see-key",
        authorizationKey: "client-must-not-see-authorization-key",
        accessToken: "client-must-not-see-access-token",
        access_token: "client-must-not-see-access-token",
        baseUrl: "https://polza.ai/api/v1",
        oauthUrl: "https://client-must-not-see-oauth.test",
        promptVersion: "greeting-assistant@2026-08-18.v3",
        readinessStatus: "ready",
        disabledMessage: "client-must-not-see-disabled-secret",
        checks: {
          providerContractReady: true,
          generationAvailable: true,
          revisionAvailable: true,
          serverValidationRequired: true,
          structuredResultRequired: true,
          backendOnlyProviderAccess: true,
          liveProviderCallPerformed: false,
          clientSecretsExposed: false,
          clientModelSelectionAllowed: false,
          providerSideEffectsAllowed: false,
          model: "nested-client-must-not-see-model",
          apiKey: "nested-client-must-not-see-key",
        },
        checkedAt: "2026-08-13T09:05:00.000Z",
      });
    },
  });

  const result = await client.getGreetingReadiness();

  assert.deepEqual(result, {
    status: "ok",
    accountId: "account-greeting-readiness",
    featureKey: "greetingAssistant",
    providerConfigured: true,
    provider: "polza",
    promptVersion: "greeting-assistant@2026-08-18.v3",
    readinessStatus: "ready",
    disabledMessage: null,
    checks: {
      providerContractReady: true,
      generationAvailable: true,
      revisionAvailable: true,
      serverValidationRequired: true,
      structuredResultRequired: true,
      backendOnlyProviderAccess: true,
      liveProviderCallPerformed: false,
      clientSecretsExposed: false,
      clientModelSelectionAllowed: false,
      providerSideEffectsAllowed: false,
    },
    checkedAt: "2026-08-13T09:05:00.000Z",
  });
  assert.equal(calls[0].url, "/api/sync/greetings/readiness");
  assert.equal(calls[0].options.headers["x-focus-account"], "account-greeting-readiness");
  assert.equal(calls[0].options.headers["x-focus-device"], "device-greeting-readiness");
  assertNoForbiddenGreetingReadiness(result);
  assertNoForbiddenGreetingReadiness(storage.toJSON());
});

test("greeting readiness client maps offline state to controlled disabled diagnostics", async () => {
  const client = createFocusSyncClient({
    apiBaseUrl: "/api",
    localStorage: createMemoryLocalStorage({
      "focus-sync-account-id": "account-greeting-offline",
      "focus-sync-device-id": "device-greeting-offline",
    }),
    fetch: async () => {
      throw new Error("offline");
    },
  });

  const result = await client.getGreetingReadiness();

  assert.equal(result.status, "offline");
  assert.equal(result.accountId, "account-greeting-offline");
  assert.equal(result.featureKey, "greetingAssistant");
  assert.equal(result.providerConfigured, false);
  assert.equal(result.provider, null);
  assert.equal(result.promptVersion, "greeting-assistant@2026-08-18.v3");
  assert.equal(result.readinessStatus, "disabled");
  assert.equal(typeof result.disabledMessage, "string");
  assert.notEqual(result.disabledMessage.trim(), "");
  assert.deepEqual(result.checks, {
    providerContractReady: false,
    generationAvailable: false,
    revisionAvailable: false,
    serverValidationRequired: true,
    structuredResultRequired: true,
    backendOnlyProviderAccess: true,
    liveProviderCallPerformed: false,
    clientSecretsExposed: false,
    clientModelSelectionAllowed: false,
    providerSideEffectsAllowed: false,
  });
  assert.equal(result.checkedAt, null);
  assertNoForbiddenGreetingReadiness(result);
});

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
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
    toJSON() {
      return Object.fromEntries(store.entries());
    },
  };
}

function assertNoForbiddenGreetingReadiness(payload) {
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
    "draft",
    "birthday",
    "birthdays",
    "reminder",
    "reminders",
    "sentStatus",
  ]);

  collectJsonKeys(payload).forEach(key => {
    assert.equal(forbiddenKeys.has(key), false, `Greeting readiness leaked forbidden key: ${key}`);
  });

  const serialized = JSON.stringify(payload);
  [
    "client-must-not-see-model",
    "sk-polza-client-must-not-see-key",
    "client-must-not-see-authorization-key",
    "client-must-not-see-access-token",
    "https://polza.ai/api/v1",
    "https://client-must-not-see-oauth.test",
    "client-must-not-see-disabled-secret",
    "nested-client-must-not-see-model",
    "nested-client-must-not-see-key",
  ].forEach(secretValue => {
    assert.equal(serialized.includes(secretValue), false, `Greeting readiness leaked forbidden value: ${secretValue}`);
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
