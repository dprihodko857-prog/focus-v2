import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const comparisonDoc = readFileSync("docs/specs/greeting-model-comparison.md", "utf8");
const providerDoc = readFileSync("docs/specs/greeting-ai-provider.md", "utf8");

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

const requiredMetrics = [
  "Russian language quality",
  "naturalness",
  "ban compliance",
  "no invented facts",
  "difference between three variants",
  "no profanity",
  "structured result validity",
  "average latency",
  "cost per request",
];

test("greeting model comparison matrix covers required production scenarios", () => {
  requiredScenarioIds.forEach(id => {
    assert.match(comparisonDoc, new RegExp(`\\\`${id}\\\``));
  });
  assert.match(comparisonDoc, /FOCUS_GREETING_AI_PROVIDER=polza/);
  assert.match(comparisonDoc, /FOCUS_POLZA_MODEL=<candidate model id>/);
  assert.match(comparisonDoc, /openai\/gpt-4o-mini/);
  assert.match(comparisonDoc, /\/api\/sync\/greetings\/generate/);
  assert.match(comparisonDoc, /Do not run this matrix in local development or CI/);
});

test("greeting model comparison matrix covers revision and metric requirements", () => {
  requiredRevisionIds.forEach(id => {
    assert.match(comparisonDoc, new RegExp(`\\\`${id}\\\``));
  });
  requiredMetrics.forEach(metric => {
    assert.match(comparisonDoc, new RegExp(metric.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  });
  assert.match(comparisonDoc, /Scenario set version: greeting-model-comparison@2026-08-13\.v1/);
});

test("greeting provider spec links to production-only comparison matrix", () => {
  assert.match(providerDoc, /docs\/specs\/greeting-model-comparison\.md/);
  assert.match(providerDoc, /production-only comparison matrix/);
});
