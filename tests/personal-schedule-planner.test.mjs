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
  assert.equal(hasOverlappingBlocks(quick.variants[0].blocks), false);
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

test("draft validation blocks overlapping generated blocks", () => {
  const overlap = validatePersonalScheduleDraft({
    intake: createDefaultPersonalScheduleIntake(),
    draft: {
      blocks: [{
        id: "focus",
        title: "Focus",
        category: "focus",
        weekday: "Вторник",
        startTime: "08:30",
        endTime: "09:30",
        startMinute: 510,
        endMinute: 570,
        flexibility: "semi_flexible",
      }, {
        id: "work",
        title: "Work",
        category: "work",
        weekday: 2,
        startTime: "09:00",
        endTime: "18:00",
        startMinute: 540,
        endMinute: 1080,
        flexibility: "fixed",
      }],
    },
  });

  assert.equal(overlap.ok, false);
  assert.equal(overlap.blockingConflicts.some(item => item.code === "draft_overlap"), true);
});

test("import batch rejects selected variants that conflict with existing fixed intervals", () => {
  const intake = createDefaultPersonalScheduleIntake();
  const draft = {
    id: "draft-conflict",
    intake,
    selectedVariantId: "variant-conflict",
    variants: [{
      id: "variant-conflict",
      title: "Conflict",
      blocks: [{
        id: "generated",
        title: "Goal",
        category: "focus",
        weekday: "Понедельник",
        weekdayLabel: "Понедельник",
        startTime: "09:30",
        endTime: "10:30",
        startMinute: 570,
        endMinute: 630,
        flexibility: "semi_flexible",
      }],
    }],
  };
  const batchResult = createPersonalScheduleImportBatch({
    draft,
    selectedVariantId: "variant-conflict",
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

  assert.equal(batchResult.ok, false);
  assert.deepEqual(batchResult.errors, ["fixed_conflict"]);
  assert.equal(batchResult.batch, null);
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
  assert.match(batchResult.batch.entities.schedules[0].note, /Идеальное расписание/);
  assert.doesNotMatch(batchResult.batch.entities.schedules[0].note, /Personal Schedule Planner/);
  assert.equal(batchResult.batch.entities.schedules[0].details["Источник"], "Идеальное расписание");
  assert.equal(batchResult.batch.entities.tasks[0].source, "personal_schedule_planner");
  assert.equal(batchResult.batch.entities.reminders[0].source, "personal_schedule_planner");

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

function hasOverlappingBlocks(blocks) {
  for (let firstIndex = 0; firstIndex < blocks.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < blocks.length; secondIndex += 1) {
      const first = blocks[firstIndex];
      const second = blocks[secondIndex];
      if (first.weekday !== second.weekday) continue;
      if (first.startMinute < second.endMinute && second.startMinute < first.endMinute) {
        return true;
      }
    }
  }
  return false;
}
