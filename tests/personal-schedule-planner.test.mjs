import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PERSONAL_SCHEDULE_BIG_FIVE_QUESTIONS,
  PERSONAL_SCHEDULE_PROMPT_VERSION,
  calculateBigFiveScores,
  cleanupPersonalScheduleImportedTasks,
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

test("energy peak moves the primary focus block toward the selected time", () => {
  const defaultIntake = createDefaultPersonalScheduleIntake();
  const base = {
    ...defaultIntake,
    work: { ...defaultIntake.work, type: "none" },
  };
  const morning = createDeterministicScheduleDraft({
    intake: { ...base, energy: { ...base.energy, peak: "morning" } },
    variantCount: 1,
    createId: prefix => `${prefix}-morning`,
  });
  const day = createDeterministicScheduleDraft({
    intake: { ...base, energy: { ...base.energy, peak: "day" } },
    variantCount: 1,
    createId: prefix => `${prefix}-day`,
  });
  const morningFocus = morning.variants[0].blocks.find(block => block.category === "focus");
  const dayFocus = day.variants[0].blocks.find(block => block.category === "focus");

  assert.equal(morningFocus.startTime, "08:30");
  assert.equal(dayFocus.startTime, "13:00");
  assert.ok(dayFocus.startMinute > morningFocus.startMinute);
});

test("Big Five tuning changes the recommended local rhythm style", () => {
  const defaultIntake = createDefaultPersonalScheduleIntake();
  const intake = {
    ...defaultIntake,
    work: { ...defaultIntake.work, type: "none" },
    goals: [{
      title: "Сложная цель",
      category: "focus",
      priority: "high",
      timesPerWeek: 3,
      minimumMinutes: 30,
      desiredMinutes: 120,
      preferredTime: "morning",
      splittable: false,
    }],
  };
  const recovery = createDeterministicScheduleDraft({
    intake,
    bigFiveScores: createTestBigFiveScores({ conscientiousness: 2, emotional_sensitivity: 5 }),
    variantCount: 1,
    createId: prefix => `${prefix}-recovery`,
  });
  const structured = createDeterministicScheduleDraft({
    intake,
    bigFiveScores: createTestBigFiveScores({ conscientiousness: 5, emotional_sensitivity: 2 }),
    variantCount: 1,
    createId: prefix => `${prefix}-structured`,
  });
  const recoveryFocus = recovery.variants[0].blocks.find(block => block.category === "focus");
  const structuredFocus = structured.variants[0].blocks.find(block => block.category === "focus");

  assert.equal(recovery.variants[0].title, "Свободнее");
  assert.equal(structured.variants[0].title, "С фокус-утром");
  assert.equal(recoveryFocus.endMinute - recoveryFocus.startMinute, 50);
  assert.equal(structuredFocus.endMinute - structuredFocus.startMinute, 70);
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
  assert.match(batchResult.batch.entities.schedules[0].note, /Персональный ритм дня/);
  assert.doesNotMatch(batchResult.batch.entities.schedules[0].note, /Personal Schedule Planner/);
  assert.equal(batchResult.batch.entities.schedules[0].details["Источник"], "Персональный ритм дня");
  assert.equal(batchResult.batch.entities.tasks[0].source, "personal_schedule_planner");
  assert.match(batchResult.batch.entities.tasks[0].title, /^\d{2}:\d{2}-\d{2}:\d{2} · /);
  assert.match(batchResult.batch.entities.tasks[0].label, /Персональный ритм/);
  assert.match(batchResult.batch.entities.tasks[0].dateKey, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(batchResult.batch.entities.reminders[0].source, "personal_schedule_planner");
  assert.match(batchResult.batch.entities.reminders[0].title, /^\d{2}:\d{2}-\d{2}:\d{2} · /);

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

test("imported Personal Rhythm tasks keep block date, time, and category context", () => {
  const intake = createDefaultPersonalScheduleIntake(new Date("2026-08-05T09:00:00.000Z"));
  intake.period = {
    ...intake.period,
    type: "full_week",
    startDate: "2026-08-05",
    endDate: "2026-08-11",
  };
  intake.work = {
    ...intake.work,
    type: "fixed",
    workdays: [1, 2, 3, 4, 5],
    startTime: "09:00",
    endTime: "18:00",
  };

  let nextId = 0;
  const draft = createDeterministicScheduleDraft({
    intake,
    now: new Date("2026-08-05T09:00:00.000Z"),
    createId: prefix => `${prefix}-${nextId += 1}`,
  });
  const batchResult = createPersonalScheduleImportBatch({
    draft,
    selectedVariantId: draft.selectedVariantId,
    includeTasks: true,
    includeReminders: true,
    now: new Date("2026-08-05T09:00:00.000Z"),
    createId: prefix => `${prefix}-${nextId += 1}`,
  });

  assert.equal(batchResult.ok, true);
  const tasks = batchResult.batch.entities.tasks;
  assert.ok(tasks.length > 1);
  assert.ok(new Set(tasks.map(task => task.dateKey)).size > 1);
  assert.ok(tasks.some(task => task.dateKey === "2026-08-05" && task.title.includes("Рабочий блок")));
  assert.ok(tasks.every(task => /^\d{2}:\d{2}-\d{2}:\d{2} · /.test(task.title)));
  assert.ok(tasks.every(task => task.label.includes("Персональный ритм")));
  assert.ok(tasks.every(task => task.label !== "Личное"));
  assert.ok(batchResult.batch.entities.reminders.every(reminder => reminder.scheduledAt.startsWith("2026-")));
});

test("cleanup removes only tasks created by Personal Rhythm imports", () => {
  const cleaned = cleanupPersonalScheduleImportedTasks({
    tasks: [
      { id: "user-task", title: "User task" },
      { id: "batch-task", title: "Old imported task" },
      { id: "source-task", title: "Imported task", source: "personal_schedule_planner", personalScheduleBlockId: "block-1" },
      { id: "foreign-source", title: "Manual task", source: "personal_schedule_planner" },
    ],
    importBatches: [{
      id: "batch-1",
      status: "applied",
      importedIds: {
        schedules: ["schedule-1"],
        tasks: ["batch-task"],
        reminders: [],
      },
    }],
    now: new Date("2026-08-05T12:00:00.000Z"),
  });

  assert.equal(cleaned.status, "tasks_cleaned");
  assert.deepEqual(cleaned.removedIds.sort(), ["batch-task", "source-task"]);
  assert.deepEqual(cleaned.tasks.map(task => task.id), ["user-task", "foreign-source"]);
  assert.deepEqual(cleaned.importBatches[0].importedIds.tasks, []);
  assert.deepEqual(cleaned.importBatches[0].cleanedTaskIds, ["batch-task"]);
  assert.equal(cleaned.cleanedAt, "2026-08-05T12:00:00.000Z");
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

function createTestBigFiveScores(overrides = {}) {
  const factors = ["openness", "conscientiousness", "extraversion", "agreeableness", "emotional_sensitivity"];
  return {
    version: "test",
    skipped: false,
    complete: true,
    answeredCount: 20,
    scores: Object.fromEntries(factors.map(factor => [
      factor,
      { average: Number.isFinite(overrides[factor]) ? overrides[factor] : 3, count: 4 },
    ])),
  };
}
