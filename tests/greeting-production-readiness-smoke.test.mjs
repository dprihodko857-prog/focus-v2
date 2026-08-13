import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createFocusSyncServer,
  createSyncDatabase,
} from "../server/sync-server.mjs";
import {
  GREETING_DISABLED_MESSAGE,
  GREETING_PROMPT_VERSION,
  createGreetingAIProviderFromEnv,
} from "../server/greeting-ai-provider.mjs";

test("polza env provider stays disabled without production gates and performs no external fetch", async () => {
  const db = createSyncDatabase(":memory:");
  let externalFetchCalls = 0;
  const provider = createGreetingAIProviderFromEnv({
    FOCUS_GREETING_AI_PROVIDER: "polza",
    FOCUS_POLZA_API_KEY: "fake-polza-key-with-enough-length",
    FOCUS_POLZA_MODEL: "openai/gpt-4o-mini",
  }, {
    fetchImpl: async () => {
      externalFetchCalls += 1;
      throw new Error("Unexpected external provider call.");
    },
    now: () => new Date("2026-08-13T09:00:00.000Z"),
  });
  assert.equal(provider.provider, "disabled");
  assert.equal(provider.available, false);

  const server = createFocusSyncServer({
    db,
    greetingAIProvider: provider,
    now: () => "2026-08-13T09:00:00.000Z",
    fetchImpl: async () => {
      externalFetchCalls += 1;
      throw new Error("Unexpected server fetch call.");
    },
  });
  const baseUrl = await listen(server);
  const accountId = "account-greeting-polza-gate-disabled";
  db.createAccount({ accountId, displayName: null, createdAt: "2026-08-13T08:00:00.000Z" });

  try {
    const statusResponse = await fetch(`${baseUrl}/api/sync/greetings/status`, {
      headers: createAccountHeaders(accountId),
    });
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json();
    assert.deepEqual(status, {
      accountId,
      providerConfigured: false,
      provider: null,
      promptVersion: GREETING_PROMPT_VERSION,
      disabledMessage: GREETING_DISABLED_MESSAGE,
      checkedAt: "2026-08-13T09:00:00.000Z",
    });
    assertNoGreetingBoundaryLeaks(status);

    const readinessResponse = await fetch(`${baseUrl}/api/sync/greetings/readiness`, {
      headers: createAccountHeaders(accountId),
    });
    assert.equal(readinessResponse.status, 200);
    const readiness = await readinessResponse.json();
    assert.deepEqual(readiness, {
      accountId,
      featureKey: "greetingAssistant",
      providerConfigured: false,
      provider: null,
      promptVersion: GREETING_PROMPT_VERSION,
      readinessStatus: "disabled",
      disabledMessage: GREETING_DISABLED_MESSAGE,
      checks: {
        providerContractReady: true,
        generationAvailable: false,
        revisionAvailable: false,
        serverValidationRequired: true,
        structuredResultRequired: true,
        backendOnlyProviderAccess: true,
        liveProviderCallPerformed: false,
        clientSecretsExposed: false,
        clientModelSelectionAllowed: false,
        providerSideEffectsAllowed: false,
      },
      checkedAt: "2026-08-13T09:00:00.000Z",
    });
    assertNoGreetingBoundaryLeaks(readiness);

    const generateResponse = await fetch(`${baseUrl}/api/sync/greetings/generate`, {
      method: "POST",
      headers: {
        ...createAccountHeaders(accountId),
        "content-type": "application/json",
      },
      body: JSON.stringify(createBirthdayGreetingRequest()),
    });
    assert.equal(generateResponse.status, 503);
    const disabled = await generateResponse.json();
    assert.equal(disabled.status, "provider_not_configured");
    assert.equal(disabled.provider, null);
    assert.equal(disabled.disabledMessage, GREETING_DISABLED_MESSAGE);
    assert.deepEqual(disabled.variants, []);
    assertNoGreetingBoundaryLeaks(disabled);

    assert.equal(externalFetchCalls, 0);
  } finally {
    await close(server);
    db.close();
  }
});

function listen(server) {
  return new Promise(resolve => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server) {
  return new Promise(resolve => server.close(resolve));
}

function createAccountHeaders(accountId) {
  return {
    "x-focus-account": accountId,
    "x-focus-device": "desktop",
  };
}

function createBirthdayGreetingRequest() {
  return {
    scenario: "birthday",
    recipient: {
      name: "Maria",
      role: "colleague",
    },
    event: {
      title: "Birthday",
      date: "2026-08-13",
    },
    context: {
      birthday: {
        name: "Maria",
        dateOfBirth: "1990-08-13",
        age: 36,
      },
      allowedFacts: ["Birthday", "colleague"],
    },
    bans: {
      mentionAge: true,
      personalTopics: [],
    },
    sender: "Focus team",
    addressMode: "vy",
    tone: "warm",
    length: "medium",
    format: "plain_text",
    variantCount: 3,
    promptVersion: GREETING_PROMPT_VERSION,
  };
}

function assertNoGreetingBoundaryLeaks(payload) {
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(
    serialized,
    /openai\/gpt-4o-mini|fake-polza-key-with-enough-length|sk-polza-|FOCUS_POLZA_|POLZA_API_KEY|polza\.ai\/api|Bearer\s+|access_token/iu,
  );
  [
    "model",
    "providerModel",
    "apiKey",
    "authorizationKey",
    "accessToken",
    "access_token",
    "baseUrl",
    "oauthUrl",
  ].forEach(key => {
    assert.equal(collectJsonKeys(payload).has(key), false, `Greeting response leaked ${key}`);
  });
}

function collectJsonKeys(value, keys = new Set()) {
  if (!value || typeof value !== "object") return keys;
  if (Array.isArray(value)) {
    value.forEach(item => collectJsonKeys(item, keys));
    return keys;
  }
  Object.entries(value).forEach(([key, item]) => {
    keys.add(key);
    collectJsonKeys(item, keys);
  });
  return keys;
}
