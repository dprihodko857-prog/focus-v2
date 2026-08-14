import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const comparisonDoc = readFileSync("docs/specs/greeting-model-comparison.md", "utf8");
const decisionRecordDoc = readFileSync("docs/specs/greeting-polza-model-comparison-decision-record.md", "utf8");
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
  assert.match(comparisonDoc, /docs\/specs\/greeting-polza-model-comparison-decision-record\.md/);
  assert.match(comparisonDoc, /\/api\/sync\/greetings\/generate/);
  assert.match(comparisonDoc, /scripts\/greeting-model-comparison-runner\.mjs/);
  assert.match(comparisonDoc, /node scripts\/greeting-model-comparison-runner\.mjs summary/);
  assert.match(comparisonDoc, /--provider=mock/);
  assert.match(comparisonDoc, /--provider=env/);
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

test("greeting model comparison decision record stays sanitized and pending approval", () => {
  [
    "Greeting Polza.ai Model Comparison Decision Record",
    "decision-record template only",
    "No production model is selected by this document",
    "Focus section \"Compose greeting\" only",
    "docs/specs/greeting-pre-key-readiness-report.md",
    "docs/specs/greeting-polza-server-secret-handoff.md",
    "docs/specs/greeting-model-comparison.md",
    "scripts/greeting-model-comparison-runner.mjs",
    "Scenario set version: `greeting-model-comparison@2026-08-13.v1`",
    "openai/gpt-4o-mini",
    "This is not a production selection.",
    "The selected model id must stay in server configuration only.",
    "node scripts/greeting-model-comparison-runner.mjs run --provider=env",
    "Do not commit live JSONL.",
    "Selected for production: no",
    "Reason: no approved live comparison run has been recorded yet.",
    "FOCUS_POLZA_MODEL_COMPARISON_APPROVED=true",
  ].forEach(marker => {
    assert.match(decisionRecordDoc, new RegExp(escapeRegExp(marker)));
  });

  requiredScenarioIds.forEach(id => {
    assert.match(decisionRecordDoc, new RegExp(`\\\`${id}\\\``));
  });

  requiredRevisionIds.forEach(id => {
    assert.match(decisionRecordDoc, new RegExp(`\\\`${id}\\\``));
  });

  requiredMetrics.forEach(metric => {
    assert.match(decisionRecordDoc, new RegExp(metric.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  });

  [
    "Current Polza availability verified: yes/no",
    "Current pricing verified: yes/no",
    "Generated records count:",
    "Revision records count:",
    "Server validation failures:",
    "Manual metric failures:",
    "Average latency:",
    "Cost per request:",
    "Approval reference:",
  ].forEach(marker => {
    assert.match(decisionRecordDoc, new RegExp(escapeRegExp(marker)));
  });

  assert.doesNotMatch(decisionRecordDoc, /sk-polza-|sk-proj-|YOUR_API_KEY|POLZA_AI_API_KEY>|Authorization:\s*Bearer\s+[^<\s]/iu);
  assert.doesNotMatch(decisionRecordDoc, /^[A-Z0-9_]*(?:API_KEY|AUTHORIZATION_KEY|ACCESS_TOKEN)=[^\s#<][^\r\n]*$/m);
  assert.doesNotMatch(decisionRecordDoc, /https:\/\/polza\.ai\/api|api\.giga\.chat|ngw\.devices\.sberbank\.ru/iu);
});

test("greeting provider spec links to production-only comparison matrix", () => {
  assert.match(providerDoc, /docs\/specs\/greeting-model-comparison\.md/);
  assert.match(providerDoc, /production-only comparison matrix/);
});

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
