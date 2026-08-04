import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PERSONAL_SCHEDULE_BIG_FIVE_QUESTIONS,
  PERSONAL_SCHEDULE_PROMPT_VERSION,
  calculateBigFiveScores,
  collectPersonalScheduleExistingIntervals,
  createDefaultPersonalScheduleIntake,
  createDeterministicScheduleDraft,
  createPersonalScheduleAiRequest,
  createPersonalScheduleImportBatch,
  applyPersonalScheduleImportBatch,
  rollbackPersonalScheduleImportBatch,
  validatePersonalScheduleAiRequest,
  validatePersonalScheduleDraft,
} from "../public/js/personal-schedule-planner.js";

test("Big Five scoring handles direct and reverse-scored questions in code", () => {
  const direct = PERSONAL_SCHEDULE_BIG_FIVE_QUESTIONS.find(question => question.factor === "conscientiousness" && question.reverseScored === false);
  const reverse = PERSONAL_SCHEDULE_BIG_FIVE_QUESTIONS.find(question => question.factor === "openness" && question.reverseScored === true);
  const scores = calculateBigFiveScores({
    [direct.id]: 5,
    [reverse.id]: 5,
  });

  assert.equal(scores.skipped, false);
  assert.equal(scores.complete, false);
  assert.equal(scores.answeredCount, 2);
  assert.equal(scores.scores[direct.factor].count >= 1, true);
  assert.equal(scores.scores[reverse.factor].average <= 1, true);
});

test("Big Five can be skipped without fabricating scores", () => {
  const scores = calculateBigFiveScores(null);

  assert.equal(scores.skipped, true);
  assert.equal(scores.complete, false);
  assert.equal(scores.answeredCount, 0);
  assert.equal(scores.scores.openness.average, null);
});

test("AI request uses structured intervals and privacy flags", () => {
  const intake = createDefaultPersonalScheduleIntake(new Date("2026-08-04T09:00:00.000Z"));
  const existingIntervals = collectPersonalScheduleExistingIntervals({
    includeCalendar: true,
    schedules: [{
      id: "schedule-work",
      type: "work",
      isActive: true,
      dayTimes: [{ day: "Понедельник", times: ["09:00-18:00 · Private title"] }],
    }],
    reminders: [{ id: "reminder-private", title: "Private reminder", scheduledAt: "2026-08-03T10:00:00.000Z" }],
  });
  const request = createPersonalScheduleAiRequest({ intake, existingIntervals });

  assert.equal(request.promptVersion, PERSONAL_SCHEDULE_PROMPT_VERSION);
  assert.equal(request.privacy.sendsDiary, false);
  assert.equal(request.privacy.sendsRawNotes, false);
  assert.equal(request.privacy.sendsPersonalEventTitles, false);
  assert.equal(request.constraints.existingIntervals[0].titleCategory, "work");
  assert.equal(request.constraints.existingIntervals.some(interval => /Private/.test(JSON.stringify(interval))), false);
  assert.deepEqual(validatePersonalScheduleAiRequest(request), { ok: true, errors: [] });
});

test("deterministic engine creates one quick variant and three deep variants", () => {
  const quick = createDeterministicScheduleDraft({
    intake: { ...createDefaultPersonalScheduleIntake(), mode: "quick" },
    variantCount: 1,
    now: new Date("2026-08-04T09:00:00.000Z"),
    createId: prefix => `${prefix}-quick`,
  });
  const deep = createDeterministicScheduleDraft({
    intake: { ...createDefaultPersonalScheduleIntake(), mode: "deep" },
    variantCount: 3,
    now: new Date("2026-08-04T09:00:00.000Z"),
    createId: prefix => `${prefix}-deep-${Math.random().toString(16).slice(2)}`,
  });

  assert.equal(quick.variants.length, 1);
  assert.equal(deep.variants.length, 3);
  assert.equal(quick.variants[0].validation.ok, true);
  assert.ok(quick.variants[0].blocks.some(block => block.category === "rest"));
});

test("draft validation blocks fixed conflicts and sleep below the requested minimum", () => {
  const intake = createDefaultPersonalScheduleIntake();
  const conflict = validatePersonalScheduleDraft({
    intake,
    draft: {
      blocks: [{
        id: "generated",
        title: "Goal",
        category: "focus",
        weekday: 1,
        startTime: "09:30",
        endTime: "10:30",
        startMinute: 570,
        endMinute: 630,
        flexibility: "semi_flexible",
      }],
    },
    existingIntervals: [{
      id: "fixed",
      sourceId: "fixed",
      weekday: 1,
      titleCategory: "work",
      category: "work",
      startTime: "09:00",
      endTime: "10:00",
      startMinute: 540,
      endMinute: 600,
      flexibility: "fixed",
    }],
  });
  const shortSleep = validatePersonalScheduleDraft({
    intake: {
      ...intake,
      sleep: {
        ...intake.sleep,
        bedTime: "02:00",
        wakeTime: "06:00",
        minimumSleepMinutes: 420,
      },
    },
    draft: { blocks: [] },
  });

  assert.equal(conflict.ok, false);
  assert.equal(conflict.blockingConflicts.some(item => item.code === "fixed_conflict"), true);
  assert.equal(shortSleep.blockingConflicts.some(item => item.code === "sleep_below_minimum"), true);
});

test("import batch writes existing Focus entities and rollback removes only imported ids", () => {
  const draft = createDeterministicScheduleDraft({
    intake: createDefaultPersonalScheduleIntake(),
    now: new Date("2026-08-04T09:00:00.000Z"),
    createId: prefix => `${prefix}-${Math.random().toString(16).slice(2)}`,
  });
  const batchResult = createPersonalScheduleImportBatch({
    draft,
    selectedVariantId: draft.selectedVariantId,
    includeTasks: true,
    includeReminders: true,
    now: new Date("2026-08-04T09:00:00.000Z"),
    createId: prefix => `${prefix}-stable`,
  });

  assert.equal(batchResult.ok, true);
  assert.equal(batchResult.batch.entities.schedules.length, 1);
  assert.ok(batchResult.batch.entities.tasks.length > 0);

  const applied = applyPersonalScheduleImportBatch({
    batch: batchResult.batch,
    schedules: [{ id: "existing-schedule", title: "Existing" }],
    tasks: [{ id: "existing-task", title: "Existing task" }],
    reminders: [{ id: "existing-reminder", title: "Existing reminder" }],
  });
  assert.equal(applied.status, "import_completed");
  assert.ok(applied.schedules.some(item => item.id === "existing-schedule"));
  assert.ok(applied.schedules.some(item => item.id === batchResult.batch.entities.schedules[0].id));

  const rolledBack = rollbackPersonalScheduleImportBatch({
    batch: applied.batch,
    schedules: applied.schedules,
    tasks: applied.tasks,
    reminders: applied.reminders,
  });
  assert.equal(rolledBack.status, "rolled_back");
  assert.ok(rolledBack.schedules.some(item => item.id === "existing-schedule"));
  assert.equal(rolledBack.schedules.some(item => item.id === batchResult.batch.entities.schedules[0].id), false);
});
