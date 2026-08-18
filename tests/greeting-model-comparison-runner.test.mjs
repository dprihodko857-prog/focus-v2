import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DisabledGreetingAIProvider,
  MockGreetingAIProvider,
  validateGreetingGenerationInput,
} from "../server/greeting-ai-provider.mjs";
import {
  GREETING_MODEL_COMPARISON_METRICS,
  GREETING_MODEL_COMPARISON_VERSION,
  assertNoForbiddenGreetingComparisonLeaks,
  createGreetingModelComparisonScenarios,
  createGreetingModelRevisionChecks,
  formatGreetingComparisonJsonl,
  runGreetingModelComparison,
} from "../scripts/greeting-model-comparison-runner.mjs";

const requiredScenarioIds = [
  "birthday-short",
  "birthday-personal",
  "official",
  "manager",
  "team",
  "professional-holiday",
  "public-holiday",
  "orthodox-holiday",
  "catholic-holiday",
  "islamic-holiday",
  "light-humor",
  "no-age",
  "no-personal-topic",
  "address-ty",
  "address-vy",
];

const requiredRevisionIds = [
  "revision-warmer",
  "revision-official",
  "revision-no-age",
  "revision-no-topic",
];

const requiredMetricIds = [
  "russianLanguageQuality",
  "naturalness",
  "banCompliance",
  "noInventedFacts",
  "variantDifference",
  "noProfanity",
  "structuredResultValidity",
  "averageLatency",
  "costPerRequest",
];

test("greeting comparison runner exposes the production scenario fixtures", () => {
  const scenarios = createGreetingModelComparisonScenarios();
  const revisions = createGreetingModelRevisionChecks({ scenarios });

  assert.equal(GREETING_MODEL_COMPARISON_VERSION, "greeting-model-comparison@2026-08-13.v1");
  assert.deepEqual(scenarios.map(scenario => scenario.id), requiredScenarioIds);
  assert.deepEqual(revisions.map(revision => revision.id), requiredRevisionIds);
  assert.deepEqual(GREETING_MODEL_COMPARISON_METRICS.map(metric => metric.id), requiredMetricIds);

  scenarios.forEach(scenario => {
    const validation = validateGreetingGenerationInput(scenario.input);
    assert.equal(validation.ok, true, `${scenario.id} should be a valid GreetingGenerationInput`);
    assert.equal(scenario.input.variantCount, 3, `${scenario.id} should request three variants`);
    assert.ok(Array.isArray(scenario.expected) && scenario.expected.length > 0);
  });

  revisions.forEach(revision => {
    assert.equal(revision.available, true, `${revision.id} base scenario must exist`);
  });
});

test("greeting comparison runner completes the matrix on mock provider without live calls", async () => {
  const provider = new MockGreetingAIProvider({
    now: () => new Date("2026-08-13T09:00:00.000Z"),
    createId: createIncrementingId("mock-comparison"),
  });
  const report = await runGreetingModelComparison({
    provider,
    candidateModelLabel: "mock-candidate",
    checkedAt: "2026-08-13T09:00:00.000Z",
  });

  assert.equal(report.records.length, requiredScenarioIds.length + requiredRevisionIds.length);
  assert.equal(report.summary.scenarioSetVersion, GREETING_MODEL_COMPARISON_VERSION);
  assert.equal(report.summary.candidateModelLabel, "mock-candidate");
  assert.equal(report.summary.provider, "mock");
  assert.equal(report.summary.allValidationPassed, true);
  assert.equal(report.summary.failedCount, 0);

  const generationRecords = report.records.filter(record => record.recordType === "generation");
  const revisionRecords = report.records.filter(record => record.recordType === "revision");
  assert.deepEqual(generationRecords.map(record => record.scenarioId), requiredScenarioIds);
  assert.deepEqual(revisionRecords.map(record => record.revisionId), requiredRevisionIds);

  report.records.forEach(record => {
    assert.equal(record.status, "generated");
    assert.equal(record.validation.ok, true);
    assert.equal(record.variantCount, 3);
    assert.ok(record.variants.every(variant => variant.text && variant.title));
    assert.deepEqual(Object.keys(record.manualMetrics), requiredMetricIds);
    assert.equal(Object.hasOwn(record, "input"), false);
    assert.equal(Object.hasOwn(record, "rawResponse"), false);
  });

  assertNoForbiddenGreetingComparisonLeaks(report);
  const jsonl = formatGreetingComparisonJsonl(report.records);
  const parsed = jsonl.split("\n").map(line => JSON.parse(line));
  assert.equal(parsed.length, report.records.length);
  assertNoForbiddenGreetingComparisonLeaks(parsed);
});

test("greeting comparison runner preserves provider usage for cost estimates", async () => {
  const mockProvider = new MockGreetingAIProvider({
    now: () => new Date("2026-08-13T09:00:00.000Z"),
    createId: createIncrementingId("usage-comparison"),
  });
  const provider = {
    provider: "usage-test",
    async generateGreeting(input) {
      const result = await mockProvider.generateGreeting(input);
      return {
        ...result,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      };
    },
    async reviseGreeting(input) {
      return mockProvider.reviseGreeting(input);
    },
  };

  const report = await runGreetingModelComparison({
    provider,
    candidateModelLabel: "usage-candidate",
    checkedAt: "2026-08-13T09:00:00.000Z",
    scenarioIds: ["birthday-short"],
    includeRevisions: false,
    costConfig: { inputPer1k: 0.1, outputPer1k: 0.2, currency: "RUB" },
  });

  assert.equal(report.summary.allValidationPassed, true);
  assert.equal(report.summary.averageEstimatedCost, 0.02);
  assert.equal(report.summary.estimatedCostCurrency, "RUB");
  assert.deepEqual(report.records[0].usage, {
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
  });
  assert.deepEqual(report.records[0].estimatedCost, {
    amount: 0.02,
    currency: "RUB",
    source: "operator_pricing_input",
  });
});

test("greeting comparison runner keeps disabled provider as controlled unavailable records", async () => {
  const report = await runGreetingModelComparison({
    provider: new DisabledGreetingAIProvider(),
    candidateModelLabel: "disabled-candidate",
    checkedAt: "2026-08-13T09:00:00.000Z",
    includeRevisions: false,
  });

  assert.equal(report.records.length, requiredScenarioIds.length);
  assert.equal(report.summary.allValidationPassed, false);
  assert.equal(report.summary.failedCount, requiredScenarioIds.length);

  report.records.forEach(record => {
    assert.equal(record.recordType, "generation");
    assert.equal(record.status, "provider_not_configured");
    assert.equal(record.validation.ok, false);
    assert.deepEqual(record.validation.errors, ["status", "variants_required"]);
    assert.equal(record.variantCount, 0);
    assert.deepEqual(record.variants, []);
  });

  assertNoForbiddenGreetingComparisonLeaks(report);
});

test("greeting comparison report redacts secret-looking provider text before JSONL output", () => {
  const record = {
    recordType: "generation",
    scenarioSetVersion: GREETING_MODEL_COMPARISON_VERSION,
    scenarioId: "secret-check",
    candidateModelLabel: "candidate",
    provider: "mock",
    status: "failed",
    promptVersion: "greeting-assistant@2026-08-18.v3",
    checkedAt: "2026-08-13T09:00:00.000Z",
    latencyMs: 0,
    inputSummary: {},
    expectedChecks: [],
    validation: { ok: false, errors: [] },
    variantCount: 1,
    variants: [
      {
        id: "variant-1",
        title: "Redacted",
        text: "Provider returned [redacted-secret] and [redacted-provider-url].",
        tone: "warm",
        format: "plain_text",
      },
    ],
    warnings: [],
    reason: null,
    usage: null,
    estimatedCost: null,
    manualMetrics: {},
  };

  const jsonl = formatGreetingComparisonJsonl([record]);
  assert.doesNotMatch(jsonl, /sk-polza-|polza\.ai\/api|Bearer\s+/iu);
});

function createIncrementingId(prefix) {
  let index = 0;
  return () => `${prefix}-${index += 1}`;
}
