import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { createGreetingAIProviderFromEnv } from "../server/greeting-ai-provider.mjs";

const envExample = readFileSync(".env.example", "utf8");
const providerDoc = readFileSync("docs/specs/greeting-ai-provider.md", "utf8");
const comparisonDoc = readFileSync("docs/specs/greeting-model-comparison.md", "utf8");
const clientShell = [
  readFileSync("public/index.html", "utf8"),
  readFileSync("public/js/app.js", "utf8"),
  readFileSync("public/js/sync.js", "utf8"),
].join("\n");

const requiredPolzaEnvNames = [
  "FOCUS_POLZA_API_KEY",
  "FOCUS_POLZA_MODEL",
  "FOCUS_POLZA_BASE_URL",
  "FOCUS_POLZA_TIMEOUT_MS",
  "FOCUS_POLZA_RETRY_ATTEMPTS",
  "FOCUS_POLZA_RATE_LIMIT_PER_MINUTE",
];

test("committed env example keeps Greeting Assistant on mock by default", async () => {
  assert.match(envExample, /^FOCUS_GREETING_AI_PROVIDER=mock$/m);
  assert.match(envExample, /^# FOCUS_GREETING_AI_PROVIDER=polza$/m);
  assert.doesNotMatch(envExample, /^FOCUS_GREETING_AI_PROVIDER=polza$/m);
  assert.doesNotMatch(envExample, /openai\/gpt-4o-mini/);

  requiredPolzaEnvNames.forEach(name => {
    assert.match(envExample, new RegExp(`^# ${name}=`, "m"));
    assert.doesNotMatch(envExample, new RegExp(`^${name}=`, "m"));
  });

  assert.doesNotMatch(envExample, /sk-polza-|sk-proj-|Bearer\s+/iu);
  assert.doesNotMatch(envExample, /^[A-Z0-9_]*(?:API_KEY|AUTHORIZATION_KEY|ACCESS_TOKEN)=[^\s#<][^\r\n]*$/m);

  const provider = createGreetingAIProviderFromEnv(parseEnvExample(envExample), {
    fetchImpl: async () => {
      throw new Error("Env example must not call external providers");
    },
    now: () => new Date("2026-08-13T09:00:00.000Z"),
    createId: createIncrementingId(),
  });
  const result = await provider.generateGreeting({
    scenario: "birthday",
    recipient: { name: "Maria", role: "colleague" },
    event: { title: "Birthday", date: "2026-08-13" },
    variantCount: 3,
  });

  assert.equal(result.status, "generated");
  assert.equal(result.provider, "mock");
  assert.equal(result.variants.length, 3);
});

test("production docs point operators to server-only Polza configuration", () => {
  assert.match(providerDoc, /\.env\.example/);
  assert.match(providerDoc, /FOCUS_GREETING_AI_PROVIDER=polza/);
  assert.match(providerDoc, /FOCUS_POLZA_API_KEY=<server secret>/);
  assert.match(providerDoc, /FOCUS_POLZA_MODEL=<model id selected by server configuration>/);
  assert.match(comparisonDoc, /FOCUS_POLZA_MODEL=<candidate model id>/);
  assert.match(comparisonDoc, /Initial low-cost ChatGPT candidate: `openai\/gpt-4o-mini`/);
});

test("frontend assets do not include production provider config names or endpoints", () => {
  [
    "FOCUS_POLZA_",
    "POLZA_API_KEY",
    "POLZA_MODEL",
    "FOCUS_GIGACHAT_AUTHORIZATION_KEY",
    "FOCUS_GIGACHAT_MODEL",
    "GIGACHAT_AUTHORIZATION_KEY",
    "GIGACHAT_MODEL",
  ].forEach(marker => {
    assert.equal(clientShell.includes(marker), false, `Client asset leaked provider marker: ${marker}`);
  });

  assert.doesNotMatch(
    clientShell,
    /polza\.ai\/api|api\.giga\.chat|ngw\.devices\.sberbank\.ru|\/v1\/chat\/completions|\/api\/v2\/oauth|sk-polza-/iu,
  );
});

function parseEnvExample(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#"))
      .map(line => {
        const separator = line.indexOf("=");
        assert.notEqual(separator, -1, `Invalid env example line: ${line}`);
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function createIncrementingId() {
  let index = 0;
  return () => `env-example-greeting-${index += 1}`;
}
