import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { createGreetingAIProviderFromEnv } from "../server/greeting-ai-provider.mjs";

const packageManifest = JSON.parse(readFileSync("package.json", "utf8"));
const envExample = readFileSync(".env.example", "utf8");
const syncService = readFileSync("server/focus-v2-sync.service", "utf8");
const providerDoc = readFileSync("docs/specs/greeting-ai-provider.md", "utf8");
const acceptanceDoc = readFileSync("docs/specs/greeting-assistant-technical-acceptance.md", "utf8");
const comparisonDoc = readFileSync("docs/specs/greeting-model-comparison.md", "utf8");
const runbookDoc = readFileSync("docs/specs/greeting-polza-production-runbook.md", "utf8");
const operatorHandoffDoc = readFileSync("docs/specs/greeting-polza-operator-handoff.md", "utf8");
const smokeReportDoc = readFileSync("docs/specs/greeting-polza-production-smoke-report.md", "utf8");
const clientShell = [
  readFileSync("public/index.html", "utf8"),
  readFileSync("public/js/app.js", "utf8"),
  readFileSync("public/js/sync.js", "utf8"),
].join("\n");

const requiredPolzaEnvNames = [
  "FOCUS_POLZA_MODEL_COMPARISON_EVALUATION_ENABLED",
  "FOCUS_POLZA_PRODUCTION_ENABLED",
  "FOCUS_POLZA_MODEL_COMPARISON_APPROVED",
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

test("deployment service keeps greeting provider secrets out of committed unit config", () => {
  assert.match(syncService, /EnvironmentFile=-\/opt\/focus-v2\/data\/focus-v2\.env/);
  assert.match(syncService, /ExecStart=\/usr\/bin\/node \/opt\/focus-v2\/server\/sync-server\.mjs/);
  assert.doesNotMatch(syncService, /FOCUS_GREETING_AI_PROVIDER=polza/);
  assert.doesNotMatch(syncService, /FOCUS_POLZA_|POLZA_API_KEY|POLZA_MODEL|FOCUS_GIGACHAT_AUTHORIZATION_KEY|GIGACHAT_AUTHORIZATION_KEY/);
  assert.doesNotMatch(syncService, /openai\/gpt-4o-mini|sk-polza-|sk-proj-|Bearer\s+/iu);
  assert.doesNotMatch(syncService, /^[A-Z0-9_]*(?:API_KEY|AUTHORIZATION_KEY|ACCESS_TOKEN)=[^\s#<][^\r\n]*$/m);
});

test("package scripts expose greeting acceptance commands without live provider calls", () => {
  const scripts = packageManifest.scripts || {};
  assert.match(scripts["test:greeting"], /tests\/greeting-client-boundary\.test\.mjs/);
  assert.match(scripts["test:greeting"], /tests\/greeting-readiness-client\.test\.mjs/);
  assert.match(scripts["test:greeting"], /tests\/greeting-production-config\.test\.mjs/);
  assert.match(scripts["test:greeting"], /tests\/greeting-production-readiness-smoke\.test\.mjs/);
  assert.match(scripts["test:greeting"], /tests\/greeting-model-comparison\.test\.mjs/);
  assert.match(scripts["test:greeting"], /tests\/greeting-model-comparison-runner\.test\.mjs/);
  assert.match(scripts["test:greeting:server"], /Polza greeting provider\|GigaChat greeting provider\|Greeting provider env factory\|sync greeting/);
  assert.match(scripts["test:greeting:server"], /tests\/focus-sync-server\.test\.mjs/);
  assert.match(scripts["greeting:comparison:mock"], /scripts\/greeting-model-comparison-runner\.mjs/);
  assert.match(scripts["greeting:comparison:mock"], /--provider=mock/);
  assert.match(scripts["greeting:comparison:mock"], /--candidate=mock/);
  assert.match(scripts["greeting:comparison:mock"], /--no-revisions/);

  const greetingScripts = [
    scripts["test:greeting"],
    scripts["test:greeting:server"],
    scripts["greeting:comparison:mock"],
  ].join("\n");
  assert.doesNotMatch(greetingScripts, /--provider=env|FOCUS_POLZA_|POLZA_API_KEY|FOCUS_GIGACHAT_AUTHORIZATION_KEY/);
  assert.doesNotMatch(greetingScripts, /sk-polza-|sk-proj-|Bearer\s+|polza\.ai\/api|api\.giga\.chat/iu);
});

test("production docs point operators to server-only Polza configuration", () => {
  assert.match(providerDoc, /\.env\.example/);
  assert.match(providerDoc, /docs\/specs\/greeting-assistant-technical-acceptance\.md/);
  assert.match(providerDoc, /docs\/specs\/greeting-polza-production-runbook\.md/);
  assert.match(providerDoc, /docs\/specs\/greeting-polza-operator-handoff\.md/);
  assert.match(runbookDoc, /docs\/specs\/greeting-polza-operator-handoff\.md/);
  assert.match(providerDoc, /FOCUS_GREETING_AI_PROVIDER=polza/);
  assert.match(providerDoc, /FOCUS_POLZA_PRODUCTION_ENABLED=true/);
  assert.match(providerDoc, /FOCUS_POLZA_MODEL_COMPARISON_APPROVED=true/);
  assert.match(providerDoc, /FOCUS_POLZA_API_KEY=<server secret>/);
  assert.match(providerDoc, /FOCUS_POLZA_MODEL=<model id selected by server configuration>/);
  assert.match(comparisonDoc, /FOCUS_POLZA_MODEL_COMPARISON_EVALUATION_ENABLED=true/);
  assert.match(comparisonDoc, /FOCUS_POLZA_MODEL=<candidate model id>/);
  assert.match(comparisonDoc, /Initial low-cost ChatGPT candidate: `openai\/gpt-4o-mini`/);
});

test("production runbook documents approved server-only Polza activation", () => {
  [
    "https://polza.ai/docs/api-reference/introduction",
    "https://polza.ai/docs/api-reference/chat/completions",
    "FOCUS_GREETING_AI_PROVIDER=polza",
    "FOCUS_POLZA_MODEL_COMPARISON_EVALUATION_ENABLED",
    "FOCUS_POLZA_PRODUCTION_ENABLED=true",
    "FOCUS_POLZA_MODEL_COMPARISON_APPROVED=true",
    "FOCUS_POLZA_API_KEY=<server secret>",
    "FOCUS_POLZA_MODEL=<selected model id>",
    "FOCUS_GREETING_AI_PROVIDER=disabled",
    "/api/health",
    "/api/sync/greetings/status",
    "/api/sync/greetings/readiness",
    "readinessStatus: \"ready\"",
    "checks.liveProviderCallPerformed: false",
    "docs/specs/greeting-model-comparison.md",
    "npm run test:greeting",
    "npm run test:greeting:server",
    "approved fake-fetch ready/generate/revise paths",
    "safe failed responses for approved provider failures without birthday or reminder changes",
    "docs/specs/greeting-polza-production-smoke-report.md",
  ].forEach(marker => {
    assert.match(runbookDoc, new RegExp(escapeRegExp(marker)));
  });

  requiredPolzaEnvNames.forEach(name => {
    assert.match(runbookDoc, new RegExp(escapeRegExp(name)));
  });

  assert.match(runbookDoc, /Do not make frontend, mobile, local development, or CI calls directly to Polza/);
  assert.match(runbookDoc, /Run only after owner approval and after secrets are installed on the server/);
  assert.match(runbookDoc, /Users must still be able to save the questionnaire and continue later/);
  assert.match(runbookDoc, /no Polza request is made/);
  assert.doesNotMatch(runbookDoc, /sk-polza-|sk-proj-|YOUR_API_KEY|POLZA_AI_API_KEY>|Authorization:\s*Bearer\s+[^<\s]/iu);
  assert.doesNotMatch(runbookDoc, /^[A-Z0-9_]*(?:API_KEY|AUTHORIZATION_KEY|ACCESS_TOKEN)=[^\s#<][^\r\n]*$/m);
});

test("production smoke report template captures sanitized live activation evidence", () => {
  [
    "Owner approval reference",
    "Approved environment",
    "Deployed source id",
    "Selected model id",
    "Secret installation method",
    "Production gate flags enabled",
    "FOCUS_POLZA_PRODUCTION_ENABLED=true",
    "FOCUS_POLZA_MODEL_COMPARISON_APPROVED=true",
    "providerConfigured: true",
    "provider: \"polza\"",
    "readinessStatus: \"ready\"",
    "checks.liveProviderCallPerformed: false",
    "https://polza.ai/api/v1/chat/completions",
    "localStorage",
    "server validation passed",
    "Average latency",
    "Estimated cost per generate request",
    "Cost per request source",
    "FOCUS_GREETING_AI_PROVIDER=disabled",
    "providerConfigured: false",
    "readinessStatus: \"disabled\"",
  ].forEach(marker => {
    assert.match(smokeReportDoc, new RegExp(escapeRegExp(marker)));
  });

  [
    "No API key or token appeared in Focus UI",
    "No model id appeared in Focus UI",
    "No provider base URL appeared in Focus UI",
    "Those actions happened only after explicit user action through Focus business logic",
    "Do not paste or record provider keys",
  ].forEach(marker => {
    assert.match(smokeReportDoc, new RegExp(escapeRegExp(marker)));
  });

  assert.doesNotMatch(smokeReportDoc, /sk-polza-|sk-proj-|YOUR_API_KEY|POLZA_AI_API_KEY>|Authorization:\s*Bearer\s+[^<\s]/iu);
  assert.doesNotMatch(smokeReportDoc, /^[A-Z0-9_]*(?:API_KEY|AUTHORIZATION_KEY|ACCESS_TOKEN)=[^\s#<][^\r\n]*$/m);
});

test("operator handoff documents production activation order without secrets", () => {
  [
    "Greeting Polza.ai Operator Handoff",
    "Do not paste API keys into chat",
    "FOCUS_GREETING_AI_PROVIDER=disabled",
    "FOCUS_GREETING_AI_PROVIDER=polza",
    "FOCUS_POLZA_MODEL_COMPARISON_EVALUATION_ENABLED=true",
    "FOCUS_POLZA_PRODUCTION_ENABLED=true",
    "FOCUS_POLZA_MODEL_COMPARISON_APPROVED=true",
    "FOCUS_POLZA_API_KEY=<server secret>",
    "FOCUS_POLZA_MODEL=<selected model id>",
    "server/focus-v2-sync.service",
    "EnvironmentFile=-/opt/focus-v2/data/focus-v2.env",
    "node scripts/greeting-model-comparison-runner.mjs summary",
    "node scripts/greeting-model-comparison-runner.mjs run --provider=env",
    "npm run test:greeting",
    "npm run test:greeting:server",
    "GET /api/health",
    "GET /api/sync/greetings/status",
    "GET /api/sync/greetings/readiness",
    "providerConfigured: true",
    "readinessStatus: \"ready\"",
    "checks.liveProviderCallPerformed: false",
    "docs/specs/greeting-polza-production-smoke-report.md",
    "FOCUS_POLZA_PRODUCTION_ENABLED=false",
    "FOCUS_POLZA_MODEL_COMPARISON_APPROVED=false",
  ].forEach(marker => {
    assert.match(operatorHandoffDoc, new RegExp(escapeRegExp(marker)));
  });

  [
    "Polza stays disabled when production gates are missing.",
    "Fake-fetch `/generate` and `/revise` pass server validation.",
    "Provider failure, timeout, and malformed output return safe failed responses.",
    "Birthday and reminder data are unchanged by provider output or provider failures.",
    "UI shows the controlled disabled state and still allows saving the questionnaire.",
  ].forEach(marker => {
    assert.match(operatorHandoffDoc, new RegExp(escapeRegExp(marker)));
  });

  requiredPolzaEnvNames.forEach(name => {
    assert.match(operatorHandoffDoc, new RegExp(escapeRegExp(name)));
  });

  assert.doesNotMatch(operatorHandoffDoc, /sk-polza-|sk-proj-|YOUR_API_KEY|POLZA_AI_API_KEY>|Authorization:\s*Bearer\s+[^<\s]/iu);
  assert.doesNotMatch(operatorHandoffDoc, /^[A-Z0-9_]*(?:API_KEY|AUTHORIZATION_KEY|ACCESS_TOKEN)=[^\s#<][^\r\n]*$/m);
});

test("technical acceptance snapshot captures implemented greeting assistant gates", () => {
  [
    "Greeting Assistant Technical Acceptance Snapshot",
    "accepted for mock-backed release and production-provider preparation",
    "Polza.ai production traffic is not approved or activated by this document",
    "Focus section \"Compose greeting\" only",
    "GreetingAIProvider",
    "generateGreeting",
    "reviseGreeting",
    "MockGreetingAIProvider",
    "DisabledGreetingAIProvider",
    "PolzaGreetingAIProvider",
    "GigaChatGreetingAIProvider",
    "YandexGreetingAIProvider",
    "OpenAIGreetingAIProvider",
    "FOCUS_POLZA_PRODUCTION_ENABLED=true",
    "FOCUS_POLZA_MODEL_COMPARISON_APPROVED=true",
    "FOCUS_POLZA_MODEL_COMPARISON_EVALUATION_ENABLED=true",
    "/api/sync/greetings/status",
    "/api/sync/greetings/readiness",
    "/api/sync/greetings/generate",
    "/api/sync/greetings/revise",
    "Генерация поздравлений пока недоступна. Анкету можно сохранить и продолжить позднее.",
    "npm run test:greeting",
    "npm run test:greeting:server",
    "npm run greeting:comparison:mock",
    "scripts/greeting-model-comparison-runner.mjs",
    "docs/specs/greeting-model-comparison.md",
    "docs/specs/greeting-polza-production-runbook.md",
    "docs/specs/greeting-polza-operator-handoff.md",
    "docs/specs/greeting-polza-production-smoke-report.md",
  ].forEach(marker => {
    assert.match(acceptanceDoc, new RegExp(escapeRegExp(marker)));
  });

  [
    "No real Polza or GigaChat credentials are committed.",
    "No live provider calls are part of local development or CI.",
    "No client-side provider integration is accepted.",
    "No provider output can perform Focus business actions without explicit user action through existing Focus workflows.",
  ].forEach(marker => {
    assert.match(acceptanceDoc, new RegExp(escapeRegExp(marker)));
  });

  assert.doesNotMatch(acceptanceDoc, /sk-polza-|sk-proj-|YOUR_API_KEY|POLZA_AI_API_KEY>|Authorization:\s*Bearer\s+[^<\s]/iu);
  assert.doesNotMatch(acceptanceDoc, /^[A-Z0-9_]*(?:API_KEY|AUTHORIZATION_KEY|ACCESS_TOKEN)=[^\s#<][^\r\n]*$/m);
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
