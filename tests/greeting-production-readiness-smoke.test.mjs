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

test("approved polza env provider reports ready and generates/revises through fake adapter without response leaks", async () => {
  const db = createSyncDatabase(":memory:");
  const providerCalls = [];
  const provider = createGreetingAIProviderFromEnv(createApprovedPolzaEnv(), {
    fetchImpl: async (url, options = {}) => {
      providerCalls.push({ url, options });
      return createOpenAICompatibleCompletionResponse();
    },
    now: () => new Date("2026-08-13T09:00:00.000Z"),
  });
  assert.equal(provider.provider, "polza");
  assert.equal(provider.isConfigured(), true);

  const server = createFocusSyncServer({
    db,
    greetingAIProvider: provider,
    now: () => "2026-08-13T09:00:00.000Z",
    fetchImpl: async () => {
      throw new Error("Unexpected server fetch call.");
    },
  });
  const baseUrl = await listen(server);
  const accountId = "account-greeting-polza-gate-ready";
  db.createAccount({ accountId, displayName: null, createdAt: "2026-08-13T08:00:00.000Z" });

  try {
    const statusResponse = await fetch(`${baseUrl}/api/sync/greetings/status`, {
      headers: createAccountHeaders(accountId),
    });
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json();
    assert.equal(status.providerConfigured, true);
    assert.equal(status.provider, "polza");
    assert.equal(status.disabledMessage, null);
    assertNoGreetingBoundaryLeaks(status);

    const readinessResponse = await fetch(`${baseUrl}/api/sync/greetings/readiness`, {
      headers: createAccountHeaders(accountId),
    });
    assert.equal(readinessResponse.status, 200);
    const readiness = await readinessResponse.json();
    assert.equal(readiness.providerConfigured, true);
    assert.equal(readiness.provider, "polza");
    assert.equal(readiness.readinessStatus, "ready");
    assert.equal(readiness.checks.generationAvailable, true);
    assert.equal(readiness.checks.revisionAvailable, true);
    assert.equal(readiness.checks.liveProviderCallPerformed, false);
    assertNoGreetingBoundaryLeaks(readiness);

    const generateResponse = await fetch(`${baseUrl}/api/sync/greetings/generate`, {
      method: "POST",
      headers: {
        ...createAccountHeaders(accountId),
        "content-type": "application/json",
      },
      body: JSON.stringify(createBirthdayGreetingRequest()),
    });
    assert.equal(generateResponse.status, 200);
    const generated = await generateResponse.json();
    assert.equal(generated.status, "generated");
    assert.equal(generated.provider, "polza");
    assert.equal(generated.promptVersion, GREETING_PROMPT_VERSION);
    assert.equal(generated.variants.length, 3);
    assert.equal(generated.safety.validated, true);
    assert.deepEqual(generated.usage, {
      promptTokens: 17,
      completionTokens: 29,
      totalTokens: 46,
    });
    assertNoGreetingBoundaryLeaks(generated);

    assert.equal(providerCalls.length, 1);
    assertProviderCallShape(providerCalls[0]);

    const reviseResponse = await fetch(`${baseUrl}/api/sync/greetings/revise`, {
      method: "POST",
      headers: {
        ...createAccountHeaders(accountId),
        "content-type": "application/json",
      },
      body: JSON.stringify(createGreetingRevisionRequest({
        sourceText: generated.variants[0].text,
      })),
    });
    assert.equal(reviseResponse.status, 200);
    const revised = await reviseResponse.json();
    assert.equal(revised.status, "generated");
    assert.equal(revised.provider, "polza");
    assert.equal(revised.promptVersion, GREETING_PROMPT_VERSION);
    assert.equal(revised.variants.length, 3);
    assert.equal(revised.safety.validated, true);
    assert.deepEqual(revised.usage, {
      promptTokens: 17,
      completionTokens: 29,
      totalTokens: 46,
    });
    assertNoGreetingBoundaryLeaks(revised);

    assert.equal(providerCalls.length, 2);
    assertProviderCallShape(providerCalls[1]);
    const revisionProviderRequest = JSON.parse(providerCalls[1].options.body);
    const revisionInput = JSON.parse(revisionProviderRequest.messages[1].content);
    assert.equal(revisionInput.instruction, "Make the text warmer.");
    assert.equal(revisionInput.sourceText, generated.variants[0].text);
    assert.equal(revisionInput.baseInput.scenario, "birthday");
  } finally {
    await close(server);
    db.close();
  }
});

test("approved polza env provider failures stay safe and leave Focus data unchanged", async () => {
  const failureCases = [
    {
      name: "http_rate_limited",
      fetchImpl: async () => createJsonResponse(429, {
        error: {
          message: "rate limit for fake-polza-production-key-with-enough-length at https://llm-provider.test/api/v1",
          model: "openai/gpt-4o-mini",
        },
      }),
    },
    {
      name: "invalid_structured_output",
      fetchImpl: async () => createJsonResponse(200, {
        choices: [{
          message: {
            content: "not json from openai/gpt-4o-mini using fake-polza-production-key-with-enough-length",
          },
        }],
      }),
    },
    {
      name: "timeout",
      fetchImpl: async () => {
        const error = new Error("provider timeout for fake-polza-production-key-with-enough-length");
        error.name = "AbortError";
        throw error;
      },
    },
  ];

  for (const failureCase of failureCases) {
    const db = createSyncDatabase(":memory:");
    let providerCallCount = 0;
    const provider = createGreetingAIProviderFromEnv(createApprovedPolzaEnv(), {
      fetchImpl: async (url, options = {}) => {
        providerCallCount += 1;
        assert.equal(url, "https://llm-provider.test/api/v1/chat/completions", failureCase.name);
        assert.equal(options.headers.Authorization, "Bearer fake-polza-production-key-with-enough-length", failureCase.name);
        return failureCase.fetchImpl(url, options);
      },
      now: () => new Date("2026-08-13T09:00:00.000Z"),
    });
    const server = createFocusSyncServer({
      db,
      greetingAIProvider: provider,
      now: () => "2026-08-13T09:00:00.000Z",
      fetchImpl: async () => {
        throw new Error("Unexpected server fetch call.");
      },
    });
    const baseUrl = await listen(server);
    const accountId = `account-greeting-polza-failure-${failureCase.name}`;
    const birthdays = [{
      id: "birthday-failure",
      name: "Maria",
      dateOfBirth: "1990-08-13",
      reminderEnabled: true,
    }];
    const reminders = [{
      id: "reminder-failure",
      title: "Congratulate Maria",
      scheduledAt: "2026-08-13T09:30:00.000Z",
    }];
    db.createAccount({ accountId, displayName: null, createdAt: "2026-08-13T08:00:00.000Z" });
    db.saveBirthdaySnapshot({ accountId, birthdays, updatedAt: "2026-08-13T08:01:00.000Z" });
    db.saveReminderSnapshot({ accountId, reminders, updatedAt: "2026-08-13T08:01:00.000Z" });
    const birthdayBefore = db.getBirthdaySnapshot(accountId);
    const reminderBefore = db.getReminderSnapshot(accountId);

    try {
      const generateResponse = await fetch(`${baseUrl}/api/sync/greetings/generate`, {
        method: "POST",
        headers: {
          ...createAccountHeaders(accountId),
          "content-type": "application/json",
        },
        body: JSON.stringify(createBirthdayGreetingRequest()),
      });
      assert.equal(generateResponse.status, 502, failureCase.name);
      assertSafeFailedGreetingResponse(await generateResponse.json(), accountId, failureCase.name);

      const reviseResponse = await fetch(`${baseUrl}/api/sync/greetings/revise`, {
        method: "POST",
        headers: {
          ...createAccountHeaders(accountId),
          "content-type": "application/json",
        },
        body: JSON.stringify(createGreetingRevisionRequest()),
      });
      assert.equal(reviseResponse.status, 502, failureCase.name);
      assertSafeFailedGreetingResponse(await reviseResponse.json(), accountId, failureCase.name);

      assert.equal(providerCallCount, 2, failureCase.name);
      assert.deepEqual(db.getBirthdaySnapshot(accountId), birthdayBefore, failureCase.name);
      assert.deepEqual(db.getReminderSnapshot(accountId), reminderBefore, failureCase.name);
    } finally {
      await close(server);
      db.close();
    }
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

function createGreetingRevisionRequest({ sourceText = "Maria, happy birthday." } = {}) {
  return {
    sourceText,
    instruction: "Make the text warmer.",
    baseInput: createBirthdayGreetingRequest(),
    promptVersion: GREETING_PROMPT_VERSION,
  };
}

function createApprovedPolzaEnv() {
  return {
    FOCUS_GREETING_AI_PROVIDER: "polza",
    FOCUS_POLZA_PRODUCTION_ENABLED: "true",
    FOCUS_POLZA_MODEL_COMPARISON_APPROVED: "true",
    FOCUS_POLZA_API_KEY: "fake-polza-production-key-with-enough-length",
    FOCUS_POLZA_MODEL: "openai/gpt-4o-mini",
    FOCUS_POLZA_BASE_URL: "https://llm-provider.test/api/v1",
    FOCUS_POLZA_RETRY_ATTEMPTS: "0",
  };
}

function assertProviderCallShape(call) {
  assert.equal(call.url, "https://llm-provider.test/api/v1/chat/completions");
  assert.equal(call.options.headers.Authorization, "Bearer fake-polza-production-key-with-enough-length");
  const providerRequest = JSON.parse(call.options.body);
  assert.equal(providerRequest.model, "openai/gpt-4o-mini");
  assert.equal(providerRequest.response_format.type, "json_schema");
  assert.equal(providerRequest.messages[0].role, "system");
  assert.equal(providerRequest.messages[1].role, "user");
  assert.doesNotMatch(call.options.body, /fake-polza-production-key-with-enough-length/);
}

function createOpenAICompatibleCompletionResponse() {
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        choices: [{
          message: {
            content: JSON.stringify({
              status: "generated",
              variants: [
                {
                  id: "one",
                  title: "One",
                  text: "Maria, congratulations on the birthday. Wishing calm focus and steady support.",
                  tone: "warm",
                  format: "plain_text",
                },
                {
                  id: "two",
                  title: "Two",
                  text: "Maria, happy birthday. May the day bring warmth, attention, and good conversations.",
                  tone: "warm",
                  format: "plain_text",
                },
                {
                  id: "three",
                  title: "Three",
                  text: "Maria, wishing you a kind birthday with simple joys and a peaceful rhythm.",
                  tone: "warm",
                  format: "plain_text",
                },
              ],
              warnings: [],
            }),
          },
        }],
        usage: {
          prompt_tokens: 17,
          completion_tokens: 29,
          total_tokens: 46,
        },
      };
    },
  };
}

function createJsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

function assertSafeFailedGreetingResponse(payload, accountId, label) {
  assert.equal(payload.accountId, accountId, label);
  assert.equal(payload.error, "greeting_provider_failed", label);
  assert.equal(payload.status, "failed", label);
  assert.equal(payload.provider, "polza", label);
  assert.equal(payload.promptVersion, GREETING_PROMPT_VERSION, label);
  assert.equal(payload.reason, "provider_validation_failed", label);
  assert.deepEqual(payload.errors, ["status", "variants_required"], label);
  assert.equal("variants" in payload, false, label);
  assert.equal("usage" in payload, false, label);
  assertNoGreetingBoundaryLeaks(payload);
}

function assertNoGreetingBoundaryLeaks(payload) {
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(
    serialized,
    /openai\/gpt-4o-mini|fake-polza-key-with-enough-length|fake-polza-production-key-with-enough-length|llm-provider\.test|sk-polza-|FOCUS_POLZA_|POLZA_API_KEY|polza\.ai\/api|Bearer\s+|access_token/iu,
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
    "draft",
    "birthday",
    "birthdays",
    "reminder",
    "reminders",
    "sentStatus",
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
