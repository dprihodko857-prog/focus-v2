import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  DisabledGreetingAIProvider,
  GREETING_PROMPT_VERSION,
  MockGreetingAIProvider,
  createGreetingAIProviderFromEnv,
  validateGreetingGenerationInput,
  validateGreetingGenerationResult,
  validateGreetingRevisionInput,
} from "../server/greeting-ai-provider.mjs";

export const GREETING_MODEL_COMPARISON_VERSION = "greeting-model-comparison@2026-08-13.v1";

export const GREETING_MODEL_COMPARISON_METRICS = [
  { id: "russianLanguageQuality", label: "Russian language quality" },
  { id: "naturalness", label: "Naturalness" },
  { id: "banCompliance", label: "Ban compliance" },
  { id: "noInventedFacts", label: "No invented facts" },
  { id: "variantDifference", label: "Difference between three variants" },
  { id: "noProfanity", label: "No profanity" },
  { id: "structuredResultValidity", label: "Structured result validity" },
  { id: "averageLatency", label: "Average latency" },
  { id: "costPerRequest", label: "Cost per request" },
];

const SECRET_STRING_PATTERN = /(sk-polza-|sk-proj-|Authorization\s*:|Bearer\s+|FOCUS_POLZA_API_KEY|POLZA_API_KEY|FOCUS_GIGACHAT_AUTHORIZATION_KEY|GIGACHAT_AUTHORIZATION_KEY|access_token|api\.giga\.chat|ngw\.devices\.sberbank\.ru|polza\.ai\/api)/iu;
const FORBIDDEN_FIELD_NAMES = new Set([
  "authorization",
  "authorizationKey",
  "apiKey",
  "accessToken",
  "secret",
  "baseUrl",
  "oauthUrl",
  "rawRequest",
  "rawResponse",
  "requestHeaders",
  "responseHeaders",
]);

export function createGreetingModelComparisonScenarios() {
  return [
    {
      id: "birthday-short",
      title: "Short birthday greeting",
      input: {
        scenario: "birthday",
        recipient: { name: "Анна", role: "коллега" },
        event: { title: "День рождения", date: "2026-08-13" },
        context: {
          birthday: { name: "Анна", dateOfBirth: "1991-08-13", age: 35 },
        },
        tone: "warm",
        length: "short",
        addressMode: "vy",
        format: "message",
        variantCount: 3,
      },
      expected: ["concise", "complete", "distinct_variants"],
    },
    {
      id: "birthday-personal",
      title: "Personal birthday greeting",
      input: {
        scenario: "birthday",
        recipient: { name: "Мария", role: "подруга" },
        event: { title: "День рождения", date: "2026-08-13" },
        context: {
          birthday: { name: "Мария", dateOfBirth: "1994-08-13", age: 32 },
          personalNote: "любит камерные концерты и семейные ужины",
          allowedFacts: ["любит камерные концерты", "любит семейные ужины"],
        },
        tone: "personal",
        length: "medium",
        addressMode: "ty",
        format: "message",
        variantCount: 3,
      },
      expected: ["uses_only_allowed_facts", "warm_personal_tone", "distinct_variants"],
    },
    {
      id: "official",
      title: "Official holiday greeting",
      input: {
        scenario: "holiday",
        holidayType: "public_holiday",
        recipient: { name: "Коллеги", role: "партнеры" },
        event: {
          title: "День России",
          date: "2026-06-12",
          holidayType: "public_holiday",
          description: "государственный праздник",
        },
        sender: "команда Focus",
        tone: "official",
        length: "medium",
        addressMode: "vy",
        format: "message",
        variantCount: 3,
      },
      expected: ["formal_tone", "no_casual_language", "no_political_invention"],
    },
    {
      id: "manager",
      title: "Greeting to a manager",
      input: {
        scenario: "birthday",
        recipient: { name: "Ирина Сергеевна", role: "руководитель" },
        event: { title: "День рождения", date: "2026-08-13" },
        context: {
          birthday: { name: "Ирина Сергеевна", dateOfBirth: "1984-08-13", age: 42 },
          allowedFacts: ["руководитель отдела"],
        },
        sender: "коллектив отдела",
        tone: "respectful",
        length: "medium",
        addressMode: "vy",
        format: "message",
        variantCount: 3,
      },
      expected: ["respectful", "not_overfamiliar", "same_recipient"],
    },
    {
      id: "team",
      title: "Greeting from a team",
      input: {
        scenario: "birthday",
        recipient: { name: "Олег", role: "коллега" },
        event: { title: "День рождения", date: "2026-08-13" },
        context: {
          birthday: { name: "Олег", dateOfBirth: "1990-08-13", age: 36 },
        },
        sender: "коллектив",
        tone: "warm",
        length: "medium",
        addressMode: "vy",
        format: "message",
        variantCount: 3,
      },
      expected: ["collective_voice", "no_fake_team_details", "distinct_variants"],
    },
    {
      id: "professional-holiday",
      title: "Professional holiday",
      input: {
        scenario: "holiday",
        holidayType: "professional_holiday",
        recipient: { name: "Елена", role: "врач" },
        event: {
          title: "День медицинского работника",
          date: "2026-06-21",
          holidayType: "professional_holiday",
          description: "профессиональный праздник медицинских работников",
        },
        tone: "respectful",
        length: "medium",
        addressMode: "vy",
        format: "message",
        variantCount: 3,
      },
      expected: ["accurate_profession_context", "respectful", "no_fake_facts"],
    },
    {
      id: "public-holiday",
      title: "Public holiday",
      input: {
        scenario: "holiday",
        holidayType: "public_holiday",
        recipient: { name: "Коллеги", role: "команда" },
        event: {
          title: "День народного единства",
          date: "2026-11-04",
          holidayType: "public_holiday",
          description: "государственный праздник",
        },
        sender: "Focus",
        tone: "official",
        length: "medium",
        addressMode: "vy",
        format: "message",
        variantCount: 3,
      },
      expected: ["balanced_public_tone", "no_political_invention", "formal"],
    },
    {
      id: "orthodox-holiday",
      title: "Orthodox holiday",
      input: {
        scenario: "holiday",
        holidayType: "religious_holiday",
        recipient: { name: "Наталья", role: "родственница" },
        event: {
          title: "Пасха",
          date: "2026-04-12",
          holidayType: "religious_holiday",
          tradition: "orthodox",
          description: "православный праздник",
        },
        tone: "warm",
        length: "medium",
        addressMode: "vy",
        format: "message",
        variantCount: 3,
      },
      expected: ["respectful_religious_wording", "orthodox_context", "no_invented_rituals"],
    },
    {
      id: "catholic-holiday",
      title: "Catholic holiday",
      input: {
        scenario: "holiday",
        holidayType: "religious_holiday",
        recipient: { name: "Алексей", role: "друг семьи" },
        event: {
          title: "Рождество",
          date: "2026-12-25",
          holidayType: "religious_holiday",
          tradition: "catholic",
          description: "католический праздник",
        },
        tone: "warm",
        length: "medium",
        addressMode: "vy",
        format: "message",
        variantCount: 3,
      },
      expected: ["catholic_context", "not_mixed_with_orthodox_wording", "respectful"],
    },
    {
      id: "islamic-holiday",
      title: "Islamic holiday",
      input: {
        scenario: "holiday",
        holidayType: "religious_holiday",
        recipient: { name: "Рустам", role: "партнер" },
        event: {
          title: "Ураза-байрам",
          date: "2026-03-20",
          holidayType: "religious_holiday",
          tradition: "islamic",
          description: "исламский праздник",
        },
        tone: "respectful",
        length: "medium",
        addressMode: "vy",
        format: "message",
        variantCount: 3,
      },
      expected: ["respectful_wording", "no_invented_rituals", "not_mixed_with_other_traditions"],
    },
    {
      id: "light-humor",
      title: "Light humor greeting",
      input: {
        scenario: "birthday",
        recipient: { name: "Дмитрий", role: "друг" },
        event: { title: "День рождения", date: "2026-08-13" },
        context: {
          birthday: { name: "Дмитрий", dateOfBirth: "1989-08-13", age: 37 },
          personalNote: "ценит спокойные выходные и хороший кофе",
          allowedFacts: ["ценит спокойные выходные", "любит хороший кофе"],
        },
        tone: "light_humor",
        length: "medium",
        addressMode: "ty",
        format: "message",
        variantCount: 3,
      },
      expected: ["gentle_humor", "no_sarcasm", "no_insult"],
    },
    {
      id: "no-age",
      title: "Age mention forbidden",
      input: {
        scenario: "birthday",
        recipient: { name: "Светлана", role: "коллега" },
        event: { title: "День рождения", date: "2026-08-13" },
        context: {
          birthday: { name: "Светлана", dateOfBirth: "1981-08-13", age: 45 },
        },
        bans: { mentionAge: true },
        tone: "warm",
        length: "medium",
        addressMode: "vy",
        format: "message",
        variantCount: 3,
      },
      expected: ["no_age_number", "no_age_phrase", "ban_compliance"],
    },
    {
      id: "no-personal-topic",
      title: "Personal topic forbidden",
      input: {
        scenario: "birthday",
        recipient: { name: "Павел", role: "знакомый" },
        event: { title: "День рождения", date: "2026-08-13" },
        context: {
          birthday: { name: "Павел", dateOfBirth: "1992-08-13", age: 34 },
          personalNote: "любит путешествия, тему ипотека не упоминать",
          allowedFacts: ["любит путешествия"],
        },
        bans: { personalTopics: ["ипотека"] },
        tone: "warm",
        length: "medium",
        addressMode: "vy",
        format: "message",
        variantCount: 3,
      },
      expected: ["forbidden_topic_absent", "allowed_facts_only", "ban_compliance"],
    },
    {
      id: "address-ty",
      title: "Informal address",
      input: {
        scenario: "birthday",
        recipient: { name: "Катя", role: "подруга" },
        event: { title: "День рождения", date: "2026-08-13" },
        context: {
          birthday: { name: "Катя", dateOfBirth: "1995-08-13", age: 31 },
        },
        tone: "warm",
        length: "medium",
        addressMode: "ty",
        format: "message",
        variantCount: 3,
      },
      expected: ["consistent_informal_address", "no_formal_address_drift", "natural"],
    },
    {
      id: "address-vy",
      title: "Formal address",
      input: {
        scenario: "birthday",
        recipient: { name: "Виктор Петрович", role: "наставник" },
        event: { title: "День рождения", date: "2026-08-13" },
        context: {
          birthday: { name: "Виктор Петрович", dateOfBirth: "1976-08-13", age: 50 },
        },
        tone: "respectful",
        length: "medium",
        addressMode: "vy",
        format: "message",
        variantCount: 3,
      },
      expected: ["consistent_formal_address", "respectful", "natural"],
    },
  ];
}

export function createGreetingModelRevisionChecks({ scenarios = createGreetingModelComparisonScenarios() } = {}) {
  const scenarioIds = new Set(scenarios.map(scenario => scenario.id));
  return [
    {
      id: "revision-warmer",
      baseScenarioId: "birthday-personal",
      instruction: "Сделай текст теплее.",
      expected: ["warmer_wording", "no_new_facts"],
    },
    {
      id: "revision-official",
      baseScenarioId: "manager",
      instruction: "Сделай текст официальнее.",
      expected: ["more_formal", "same_recipient", "same_event"],
    },
    {
      id: "revision-no-age",
      baseScenarioId: "no-age",
      instruction: "Сохрани запрет на упоминание возраста.",
      expected: ["age_still_absent", "ban_compliance"],
    },
    {
      id: "revision-no-topic",
      baseScenarioId: "no-personal-topic",
      instruction: "Не упоминай запрещенную личную тему.",
      expected: ["forbidden_topic_still_absent", "ban_compliance"],
    },
  ].map(check => ({
    ...check,
    available: scenarioIds.has(check.baseScenarioId),
  }));
}

export async function runGreetingModelComparison({
  provider = new MockGreetingAIProvider({ createId: createIncrementingId("comparison-greeting") }),
  scenarios = createGreetingModelComparisonScenarios(),
  revisionChecks = createGreetingModelRevisionChecks({ scenarios }),
  scenarioIds = [],
  includeRevisions = true,
  candidateModelLabel = "mock",
  checkedAt = new Date().toISOString(),
  costConfig = {},
} = {}) {
  const selectedScenarioIds = new Set(Array.isArray(scenarioIds) ? scenarioIds.filter(Boolean) : []);
  const selectedScenarios = selectedScenarioIds.size
    ? scenarios.filter(scenario => selectedScenarioIds.has(scenario.id))
    : scenarios;
  const safeCandidateModelLabel = sanitizeComparisonLabel(candidateModelLabel || provider?.provider || "candidate");
  const generationRuns = [];
  const records = [];

  for (const scenario of selectedScenarios) {
    const generationRun = await runGenerationScenario({
      provider,
      scenario,
      candidateModelLabel: safeCandidateModelLabel,
      checkedAt,
      costConfig,
    });
    generationRuns.push(generationRun);
    records.push(generationRun.record);
  }

  if (includeRevisions) {
    const generationByScenarioId = new Map(generationRuns.map(run => [run.scenario.id, run]));
    const selectedRevisionChecks = revisionChecks.filter(check => generationByScenarioId.has(check.baseScenarioId));
    for (const revisionCheck of selectedRevisionChecks) {
      const revisionRun = await runRevisionCheck({
        provider,
        revisionCheck,
        generationRun: generationByScenarioId.get(revisionCheck.baseScenarioId),
        candidateModelLabel: safeCandidateModelLabel,
        checkedAt,
        costConfig,
      });
      records.push(revisionRun.record);
    }
  }

  const summary = createGreetingModelComparisonSummary(records, {
    candidateModelLabel: safeCandidateModelLabel,
    checkedAt,
    providerName: sanitizeComparisonLabel(provider?.provider || records[0]?.provider || "unknown"),
  });

  assertNoForbiddenGreetingComparisonLeaks({ records, summary });
  return { records, summary };
}

export function createGreetingModelComparisonSummary(
  records = [],
  { candidateModelLabel = "candidate", providerName = "unknown", checkedAt = new Date().toISOString() } = {},
) {
  const normalizedRecords = Array.isArray(records) ? records : [];
  const completedRecords = normalizedRecords.filter(record => record.status !== "skipped");
  const passedRecords = completedRecords.filter(record => record.validation?.ok === true);
  const failedRecords = normalizedRecords.filter(record => record.validation?.ok !== true);
  const latencyValues = completedRecords
    .map(record => Number(record.latencyMs))
    .filter(value => Number.isFinite(value) && value >= 0);
  const costValues = completedRecords
    .map(record => Number(record.estimatedCost?.amount))
    .filter(value => Number.isFinite(value) && value >= 0);

  return {
    scenarioSetVersion: GREETING_MODEL_COMPARISON_VERSION,
    candidateModelLabel: sanitizeComparisonLabel(candidateModelLabel),
    provider: sanitizeComparisonLabel(providerName),
    checkedAt: sanitizeTimestamp(checkedAt),
    recordCount: normalizedRecords.length,
    generationCount: normalizedRecords.filter(record => record.recordType === "generation").length,
    revisionCount: normalizedRecords.filter(record => record.recordType === "revision").length,
    passedCount: passedRecords.length,
    failedCount: failedRecords.length,
    allValidationPassed: normalizedRecords.length > 0 && failedRecords.length === 0,
    averageLatencyMs: latencyValues.length ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length) : null,
    averageEstimatedCost: costValues.length
      ? roundCurrency(costValues.reduce((sum, value) => sum + value, 0) / costValues.length)
      : null,
    estimatedCostCurrency: costConfigCurrencyFromRecords(completedRecords) || null,
    requiredManualMetrics: GREETING_MODEL_COMPARISON_METRICS.map(metric => metric.id),
  };
}

export function formatGreetingComparisonJsonl(records = []) {
  const lines = (Array.isArray(records) ? records : []).map(record => {
    assertNoForbiddenGreetingComparisonLeaks(record);
    return JSON.stringify(record);
  });
  return lines.join("\n");
}

export function assertNoForbiddenGreetingComparisonLeaks(value) {
  inspectForForbiddenLeaks(value, []);
}

async function runGenerationScenario({
  provider,
  scenario,
  candidateModelLabel,
  checkedAt,
  costConfig,
}) {
  const inputValidation = validateGreetingGenerationInput(scenario.input);
  if (!inputValidation.ok) {
    return {
      scenario,
      input: inputValidation.input,
      result: null,
      record: createComparisonRecord({
        recordType: "generation",
        scenario,
        candidateModelLabel,
        providerName: provider?.provider || "unknown",
        status: "invalid_request",
        promptVersion: GREETING_PROMPT_VERSION,
        checkedAt,
        latencyMs: 0,
        input: inputValidation.input,
        validation: { ok: false, errors: inputValidation.errors },
        result: null,
        costConfig,
      }),
    };
  }

  return timeProviderCall(async () => provider.generateGreeting(inputValidation.input))
    .then(({ result, latencyMs }) => ({
      scenario,
      input: inputValidation.input,
      result,
      record: createValidatedComparisonRecord({
        recordType: "generation",
        scenario,
        candidateModelLabel,
        providerName: provider?.provider || result?.provider || "unknown",
        checkedAt,
        latencyMs,
        input: inputValidation.input,
        result,
        costConfig,
      }),
    }))
    .catch(error => ({
      scenario,
      input: inputValidation.input,
      result: null,
      record: createComparisonRecord({
        recordType: "generation",
        scenario,
        candidateModelLabel,
        providerName: provider?.provider || "unknown",
        status: "failed",
        promptVersion: GREETING_PROMPT_VERSION,
        checkedAt,
        latencyMs: 0,
        input: inputValidation.input,
        validation: { ok: false, errors: ["provider_exception"] },
        result: {
          reason: sanitizeComparisonText(error?.reason || error?.message || "provider_exception", 160),
          warnings: [],
          variants: [],
        },
        costConfig,
      }),
    }));
}

async function runRevisionCheck({
  provider,
  revisionCheck,
  generationRun,
  candidateModelLabel,
  checkedAt,
  costConfig,
}) {
  const sourceText = generationRun?.result?.variants?.[0]?.text || "";
  const baseInput = generationRun?.input || {};
  if (!sourceText) {
    return {
      record: createSkippedRevisionRecord({
        revisionCheck,
        generationRun,
        candidateModelLabel,
        providerName: provider?.provider || generationRun?.record?.provider || "unknown",
        checkedAt,
        reason: "base_generation_unavailable",
      }),
    };
  }

  const revisionInput = {
    sourceText,
    instruction: revisionCheck.instruction,
    baseInput,
  };
  const inputValidation = validateGreetingRevisionInput(revisionInput);
  if (!inputValidation.ok) {
    return {
      record: createComparisonRecord({
        recordType: "revision",
        scenario: generationRun.scenario,
        revisionCheck,
        candidateModelLabel,
        providerName: provider?.provider || "unknown",
        status: "invalid_request",
        promptVersion: GREETING_PROMPT_VERSION,
        checkedAt,
        latencyMs: 0,
        input: inputValidation.input.baseInput,
        validation: { ok: false, errors: inputValidation.errors },
        result: null,
        costConfig,
      }),
    };
  }

  return timeProviderCall(async () => provider.reviseGreeting(inputValidation.input))
    .then(({ result, latencyMs }) => ({
      record: createValidatedComparisonRecord({
        recordType: "revision",
        scenario: generationRun.scenario,
        revisionCheck,
        candidateModelLabel,
        providerName: provider?.provider || result?.provider || "unknown",
        checkedAt,
        latencyMs,
        input: inputValidation.input.baseInput,
        result,
        costConfig,
      }),
    }))
    .catch(error => ({
      record: createComparisonRecord({
        recordType: "revision",
        scenario: generationRun.scenario,
        revisionCheck,
        candidateModelLabel,
        providerName: provider?.provider || "unknown",
        status: "failed",
        promptVersion: GREETING_PROMPT_VERSION,
        checkedAt,
        latencyMs: 0,
        input: inputValidation.input.baseInput,
        validation: { ok: false, errors: ["provider_exception"] },
        result: {
          reason: sanitizeComparisonText(error?.reason || error?.message || "provider_exception", 160),
          warnings: [],
          variants: [],
        },
        costConfig,
      }),
    }));
}

function createValidatedComparisonRecord({
  recordType,
  scenario,
  revisionCheck,
  candidateModelLabel,
  providerName,
  checkedAt,
  latencyMs,
  input,
  result,
  costConfig,
}) {
  const validation = validateGreetingGenerationResult(result, input);
  return createComparisonRecord({
    recordType,
    scenario,
    revisionCheck,
    candidateModelLabel,
    providerName,
    status: result?.status || "failed",
    promptVersion: result?.promptVersion || GREETING_PROMPT_VERSION,
    checkedAt,
    latencyMs,
    input,
    validation: {
      ok: validation.ok,
      errors: validation.errors,
    },
    result: validation.ok ? validation.result : result,
    costConfig,
  });
}

function createComparisonRecord({
  recordType,
  scenario,
  revisionCheck,
  candidateModelLabel,
  providerName,
  status,
  promptVersion,
  checkedAt,
  latencyMs,
  input,
  validation,
  result,
  costConfig,
}) {
  const usage = sanitizeUsage(result?.usage);
  const record = {
    recordType,
    scenarioSetVersion: GREETING_MODEL_COMPARISON_VERSION,
    scenarioId: scenario.id,
    candidateModelLabel: sanitizeComparisonLabel(candidateModelLabel),
    provider: sanitizeComparisonLabel(providerName || result?.provider || "unknown"),
    status: sanitizeComparisonStatus(status),
    promptVersion: promptVersion === GREETING_PROMPT_VERSION ? promptVersion : GREETING_PROMPT_VERSION,
    checkedAt: sanitizeTimestamp(checkedAt),
    latencyMs: Math.max(0, Math.round(Number(latencyMs) || 0)),
    inputSummary: createInputSummary(input),
    expectedChecks: normalizeStringList(revisionCheck?.expected || scenario.expected, 20, 80),
    validation: {
      ok: validation?.ok === true,
      errors: normalizeStringList(validation?.errors, 20, 80),
    },
    variantCount: Array.isArray(result?.variants) ? Math.min(result.variants.length, 3) : 0,
    variants: sanitizeVariants(result?.variants),
    warnings: normalizeStringList(result?.warnings, 20, 120),
    reason: sanitizeComparisonText(result?.reason || "", 120) || null,
    usage,
    estimatedCost: createEstimatedCost({ usage, costConfig }),
    manualMetrics: createManualMetricSlots(),
  };

  if (recordType === "revision") {
    record.revisionId = revisionCheck.id;
    record.baseScenarioId = revisionCheck.baseScenarioId;
    record.revisionInstructionLabel = sanitizeComparisonLabel(revisionCheck.id);
  }

  assertNoForbiddenGreetingComparisonLeaks(record);
  return record;
}

function createSkippedRevisionRecord({
  revisionCheck,
  generationRun,
  candidateModelLabel,
  providerName,
  checkedAt,
  reason,
}) {
  const record = {
    recordType: "revision",
    scenarioSetVersion: GREETING_MODEL_COMPARISON_VERSION,
    scenarioId: generationRun?.scenario?.id || revisionCheck.baseScenarioId,
    revisionId: revisionCheck.id,
    baseScenarioId: revisionCheck.baseScenarioId,
    revisionInstructionLabel: sanitizeComparisonLabel(revisionCheck.id),
    candidateModelLabel: sanitizeComparisonLabel(candidateModelLabel),
    provider: sanitizeComparisonLabel(providerName),
    status: "skipped",
    promptVersion: GREETING_PROMPT_VERSION,
    checkedAt: sanitizeTimestamp(checkedAt),
    latencyMs: 0,
    inputSummary: createInputSummary(generationRun?.input || {}),
    expectedChecks: normalizeStringList(revisionCheck.expected, 20, 80),
    validation: { ok: false, errors: [sanitizeComparisonLabel(reason)] },
    variantCount: 0,
    variants: [],
    warnings: [],
    reason: sanitizeComparisonLabel(reason),
    usage: null,
    estimatedCost: null,
    manualMetrics: createManualMetricSlots(),
  };

  assertNoForbiddenGreetingComparisonLeaks(record);
  return record;
}

async function timeProviderCall(callProvider) {
  const startedAt = Date.now();
  const result = await callProvider();
  return {
    result,
    latencyMs: Date.now() - startedAt,
  };
}

function createInputSummary(input = {}) {
  return {
    scenario: sanitizeComparisonLabel(input.scenario),
    holidayType: sanitizeComparisonLabel(input.holidayType || input.event?.holidayType || ""),
    eventTitle: sanitizeComparisonText(input.event?.title || "", 160) || null,
    eventTradition: sanitizeComparisonLabel(input.event?.tradition || ""),
    recipientRole: sanitizeComparisonText(input.recipient?.role || "", 120) || null,
    senderPresent: Boolean(input.sender),
    addressMode: sanitizeComparisonLabel(input.addressMode),
    tone: sanitizeComparisonLabel(input.tone),
    length: sanitizeComparisonLabel(input.length),
    format: sanitizeComparisonLabel(input.format),
    variantCount: Math.max(0, Math.min(3, Math.round(Number(input.variantCount) || 0))),
    hasPersonalNote: Boolean(input.context?.personalNote),
    allowedFactCount: Array.isArray(input.context?.allowedFacts) ? input.context.allowedFacts.length : 0,
    bans: {
      mentionAge: input.bans?.mentionAge === true,
      personalTopicCount: Array.isArray(input.bans?.personalTopics) ? input.bans.personalTopics.length : 0,
    },
  };
}

function sanitizeVariants(variants = []) {
  return (Array.isArray(variants) ? variants : [])
    .slice(0, 3)
    .map((variant, index) => ({
      id: sanitizeComparisonLabel(variant?.id || `variant-${index + 1}`),
      title: sanitizeComparisonText(variant?.title || `Variant ${index + 1}`, 120),
      text: sanitizeComparisonText(variant?.text || "", 1800),
      tone: sanitizeComparisonLabel(variant?.tone || ""),
      format: sanitizeComparisonLabel(variant?.format || ""),
    }))
    .filter(variant => variant.text);
}

function sanitizeUsage(usage = null) {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return null;
  return {
    promptTokens: normalizeNonNegativeInteger(usage.promptTokens),
    completionTokens: normalizeNonNegativeInteger(usage.completionTokens),
    totalTokens: normalizeNonNegativeInteger(usage.totalTokens),
  };
}

function createEstimatedCost({ usage, costConfig = {} }) {
  if (!usage) return null;
  const inputPer1k = normalizeFiniteNumber(costConfig.inputPer1k);
  const outputPer1k = normalizeFiniteNumber(costConfig.outputPer1k);
  if (inputPer1k === null || outputPer1k === null) return null;

  const amount = (usage.promptTokens * inputPer1k + usage.completionTokens * outputPer1k) / 1000;
  return {
    amount: roundCurrency(amount),
    currency: sanitizeComparisonLabel(costConfig.currency || "RUB"),
    source: "operator_pricing_input",
  };
}

function costConfigCurrencyFromRecords(records) {
  const costRecord = records.find(record => record.estimatedCost?.currency);
  return costRecord?.estimatedCost?.currency || "";
}

function createManualMetricSlots() {
  return Object.fromEntries(GREETING_MODEL_COMPARISON_METRICS.map(metric => [metric.id, null]));
}

function normalizeStringList(value, maxItems = 12, maxLength = 120) {
  const seen = new Set();
  return (Array.isArray(value) ? value : [])
    .map(item => sanitizeComparisonText(item, maxLength))
    .filter(item => item && !seen.has(item) && seen.add(item))
    .slice(0, maxItems);
}

function sanitizeComparisonText(value, maxLength = 500) {
  if (typeof value !== "string") return "";
  return redactSecretMarkers(value)
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, maxLength);
}

function sanitizeComparisonLabel(value) {
  const label = sanitizeComparisonText(String(value || ""), 120)
    .replace(/[^a-zA-Z0-9_.:-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return label || "unknown";
}

function sanitizeComparisonStatus(value) {
  const status = sanitizeComparisonLabel(value);
  return ["generated", "provider_not_configured", "invalid_request", "failed", "skipped"].includes(status)
    ? status
    : "failed";
}

function sanitizeTimestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function redactSecretMarkers(value) {
  return String(value || "")
    .replace(/Authorization\s*:\s*[^\s,;}]+/giu, "[redacted-authorization]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/giu, "[redacted-authorization]")
    .replace(/\bsk-(?:polza|proj|live|test)-[A-Za-z0-9_-]+/giu, "[redacted-secret]")
    .replace(/\b(?:FOCUS_)?POLZA_API_KEY\b/giu, "[redacted-env]")
    .replace(/\b(?:FOCUS_)?GIGACHAT_AUTHORIZATION_KEY\b/giu, "[redacted-env]")
    .replace(/\baccess_token\b/giu, "[redacted-token-field]")
    .replace(/https?:\/\/(?:polza\.ai\/api|api\.giga\.chat|ngw\.devices\.sberbank\.ru)[^\s"']*/giu, "[redacted-provider-url]");
}

function normalizeNonNegativeInteger(value) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalizeFiniteNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function roundCurrency(value) {
  return Math.round((Number(value) || 0) * 1_000_000) / 1_000_000;
}

function inspectForForbiddenLeaks(value, path) {
  if (typeof value === "string") {
    if (SECRET_STRING_PATTERN.test(value)) {
      throw new Error(`Forbidden provider secret marker in comparison report at ${path.join(".") || "<root>"}.`);
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectForForbiddenLeaks(item, [...path, String(index)]));
    return;
  }

  Object.entries(value).forEach(([key, item]) => {
    if (FORBIDDEN_FIELD_NAMES.has(key)) {
      throw new Error(`Forbidden provider field in comparison report at ${[...path, key].join(".")}.`);
    }
    inspectForForbiddenLeaks(item, [...path, key]);
  });
}

function createIncrementingId(prefix) {
  let index = 0;
  return () => `${prefix}-${index += 1}`;
}

function parseCliArgs(argv = process.argv.slice(2)) {
  const args = {
    command: "summary",
    providerMode: "mock",
    candidateModelLabel: "mock",
    outputPath: "",
    includeRevisions: true,
    scenarioIds: [],
    costConfig: {},
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--") && args.command === "summary") {
      args.command = arg;
      continue;
    }

    const [rawName, inlineValue] = arg.split(/=(.*)/s, 2);
    const name = rawName.replace(/^--/, "");
    const value = inlineValue !== undefined ? inlineValue : argv[index + 1];
    const consumesNext = inlineValue === undefined && value && !String(value).startsWith("--");

    if (name === "provider") {
      args.providerMode = sanitizeComparisonLabel(value);
      if (consumesNext) index += 1;
    } else if (name === "candidate") {
      args.candidateModelLabel = sanitizeComparisonLabel(value);
      if (consumesNext) index += 1;
    } else if (name === "out") {
      args.outputPath = String(value || "");
      if (consumesNext) index += 1;
    } else if (name === "scenario") {
      args.scenarioIds.push(sanitizeComparisonLabel(value));
      if (consumesNext) index += 1;
    } else if (name === "no-revisions") {
      args.includeRevisions = false;
    } else if (name === "input-token-price") {
      args.costConfig.inputPer1k = normalizeFiniteNumber(value);
      if (consumesNext) index += 1;
    } else if (name === "output-token-price") {
      args.costConfig.outputPer1k = normalizeFiniteNumber(value);
      if (consumesNext) index += 1;
    } else if (name === "currency") {
      args.costConfig.currency = sanitizeComparisonLabel(value);
      if (consumesNext) index += 1;
    }
  }

  return args;
}

function createCliProvider(providerMode) {
  if (providerMode === "mock") {
    return new MockGreetingAIProvider({ createId: createIncrementingId("comparison-greeting") });
  }
  if (providerMode === "disabled") {
    return new DisabledGreetingAIProvider();
  }
  if (providerMode === "env") {
    return createGreetingAIProviderFromEnv(process.env, {
      createId: createIncrementingId("comparison-greeting"),
    });
  }
  throw new Error(`Unsupported provider mode: ${providerMode}. Use mock, disabled, or env.`);
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function runCli() {
  const args = parseCliArgs();
  const scenarios = createGreetingModelComparisonScenarios();

  if (args.command === "summary") {
    printJson({
      scenarioSetVersion: GREETING_MODEL_COMPARISON_VERSION,
      defaultProviderMode: "mock",
      scenarioIds: scenarios.map(scenario => scenario.id),
      revisionIds: createGreetingModelRevisionChecks({ scenarios }).map(check => check.id),
      metrics: GREETING_MODEL_COMPARISON_METRICS,
    });
    return;
  }

  if (args.command !== "run") {
    throw new Error(`Unsupported command: ${args.command}. Use summary or run.`);
  }

  const provider = createCliProvider(args.providerMode);
  const report = await runGreetingModelComparison({
    provider,
    scenarios,
    scenarioIds: args.scenarioIds,
    includeRevisions: args.includeRevisions,
    candidateModelLabel: args.candidateModelLabel,
    costConfig: args.costConfig,
  });
  const jsonl = `${formatGreetingComparisonJsonl(report.records)}\n`;

  if (args.outputPath) {
    const outputPath = resolve(args.outputPath);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, jsonl, "utf8");
    printJson({ status: "completed", outputPath, summary: report.summary });
    return;
  }

  process.stdout.write(jsonl);
}

function isCliInvocation() {
  return process.argv[1] === "-"
    || (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href);
}

if (isCliInvocation()) {
  runCli().catch(error => {
    process.stderr.write(`${error?.message || error}\n`);
    process.exitCode = 1;
  });
}
