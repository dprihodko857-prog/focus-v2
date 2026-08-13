import assert from "node:assert/strict";
import { test } from "node:test";

import {
  GREETING_PRODUCTION_PREFLIGHT_VERSION,
  parseGreetingPreflightEnv,
  runGreetingProductionPreflight,
} from "../scripts/greeting-production-preflight.mjs";

const checkedAt = "2026-08-13T09:00:00.000Z";
const safeClientSources = [
  {
    path: "public/index.html",
    source: "<main data-section=\"compose-greeting\"></main>",
  },
  {
    path: "public/js/app.js",
    source: "fetch('/api/sync/greetings/generate'); fetch('/api/sync/greetings/readiness');",
  },
  {
    path: "public/js/sync.js",
    source: "export const greetingRoutes = ['/api/sync/greetings/status'];",
  },
];

test("greeting production preflight passes default mock mode without live provider calls", () => {
  const report = runGreetingProductionPreflight({
    env: { FOCUS_GREETING_AI_PROVIDER: "mock" },
    clientSources: safeClientSources,
    checkedAt,
  });

  assert.equal(report.version, GREETING_PRODUCTION_PREFLIGHT_VERSION);
  assert.equal(report.status, "passed");
  assert.equal(report.requestedProvider, "mock");
  assert.equal(report.effectiveProvider, "mock");
  assert.equal(report.providerConfigured, true);
  assert.equal(report.productionActivationReady, false);
  assert.equal(report.liveProviderCallPerformed, false);
  assert.equal(report.clientBoundary.passed, true);
  assert.equal(getCheck(report, "client_boundary").pass, true);
  assert.equal(getCheck(report, "no_live_provider_call").pass, true);
});

test("greeting production preflight fails Polza when production gates are absent", () => {
  const report = runGreetingProductionPreflight({
    env: {
      FOCUS_GREETING_AI_PROVIDER: "polza",
      FOCUS_POLZA_API_KEY: "sk-polza-secret-for-test",
      FOCUS_POLZA_MODEL: "openai/gpt-4o-mini",
      FOCUS_POLZA_BASE_URL: "https://polza.ai/api/v1",
    },
    clientSources: safeClientSources,
    checkedAt,
  });

  assert.equal(report.status, "failed");
  assert.equal(report.requestedProvider, "polza");
  assert.equal(report.effectiveProvider, "disabled");
  assert.equal(report.providerConfigured, false);
  assert.equal(report.activationMode, "disabled");
  assert.equal(report.productionActivationReady, false);
  assert.equal(report.liveProviderCallPerformed, false);
  assert.equal(report.polza.productionGateApproved, false);
  assert.equal(report.polza.apiKeyConfigured, true);
  assert.equal(report.polza.modelConfigured, true);
  assert.equal(getCheck(report, "polza_activation_gate").pass, false);
  assertSafeReport(report);
});

test("greeting production preflight passes approved Polza server configuration without provider fetch", () => {
  const report = runGreetingProductionPreflight({
    env: {
      FOCUS_GREETING_AI_PROVIDER: "polza",
      FOCUS_POLZA_PRODUCTION_ENABLED: "true",
      FOCUS_POLZA_MODEL_COMPARISON_APPROVED: "true",
      FOCUS_POLZA_API_KEY: "sk-polza-secret-for-test",
      FOCUS_POLZA_MODEL: "openai/gpt-4o-mini",
      FOCUS_POLZA_BASE_URL: "https://polza.ai/api/v1",
    },
    clientSources: safeClientSources,
    checkedAt,
  });

  assert.equal(report.status, "passed");
  assert.equal(report.requestedProvider, "polza");
  assert.equal(report.effectiveProvider, "polza");
  assert.equal(report.providerConfigured, true);
  assert.equal(report.activationMode, "production");
  assert.equal(report.productionActivationReady, true);
  assert.equal(report.liveProviderCallPerformed, false);
  assert.equal(getCheck(report, "polza_activation_gate").pass, true);
  assert.equal(getCheck(report, "polza_server_configuration").pass, true);
  assertSafeReport(report);
});

test("greeting production preflight separates model-comparison Polza from production activation", () => {
  const report = runGreetingProductionPreflight({
    env: {
      FOCUS_GREETING_AI_PROVIDER: "polza",
      FOCUS_POLZA_MODEL_COMPARISON_EVALUATION_ENABLED: "true",
      FOCUS_POLZA_API_KEY: "sk-polza-secret-for-test",
      FOCUS_POLZA_MODEL: "openai/gpt-4o-mini",
    },
    clientSources: safeClientSources,
    checkedAt,
  });

  assert.equal(report.status, "passed");
  assert.equal(report.effectiveProvider, "polza");
  assert.equal(report.providerConfigured, true);
  assert.equal(report.activationMode, "model_comparison");
  assert.equal(report.productionActivationReady, false);
  assert.equal(report.polza.modelComparisonEvaluationEnabled, true);
  assert.match(report.warnings.join("\n"), /model comparison only/);
  assertSafeReport(report);
});

test("greeting production preflight fails when client contains provider endpoint markers", () => {
  const report = runGreetingProductionPreflight({
    env: { FOCUS_GREETING_AI_PROVIDER: "mock" },
    clientSources: [
      ...safeClientSources,
      {
        path: "public/js/leaky-client.js",
        source: "fetch('https://polza.ai/api/v1/chat/completions');",
      },
    ],
    checkedAt,
  });

  assert.equal(report.status, "failed");
  assert.equal(report.clientBoundary.passed, false);
  assert.equal(getCheck(report, "client_boundary").pass, false);
  assert.deepEqual(
    report.clientBoundary.findings.map(finding => finding.markerId),
    ["polza_endpoint"],
  );
});

test("greeting preflight env parser supports comments and quoted values", () => {
  const parsed = parseGreetingPreflightEnv(`
# server-only values
FOCUS_GREETING_AI_PROVIDER=polza
FOCUS_POLZA_PRODUCTION_ENABLED=true
FOCUS_POLZA_MODEL_COMPARISON_APPROVED='true'
FOCUS_POLZA_API_KEY="sk-polza-secret-for-test"
FOCUS_POLZA_MODEL="openai/gpt-4o-mini"
`);

  assert.deepEqual(parsed, {
    FOCUS_GREETING_AI_PROVIDER: "polza",
    FOCUS_POLZA_PRODUCTION_ENABLED: "true",
    FOCUS_POLZA_MODEL_COMPARISON_APPROVED: "true",
    FOCUS_POLZA_API_KEY: "sk-polza-secret-for-test",
    FOCUS_POLZA_MODEL: "openai/gpt-4o-mini",
  });
});

function getCheck(report, id) {
  const check = report.checks.find(candidate => candidate.id === id);
  assert.ok(check, `Missing preflight check: ${id}`);
  return check;
}

function assertSafeReport(report) {
  const serialized = JSON.stringify(report);
  [
    "sk-polza-secret-for-test",
    "openai/gpt-4o-mini",
    "https://polza.ai/api/v1",
  ].forEach(secretLikeValue => {
    assert.equal(serialized.includes(secretLikeValue), false, `Report leaked ${secretLikeValue}`);
  });
}
