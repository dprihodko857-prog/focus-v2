export const PERSONAL_SCHEDULE_PROMPT_VERSION = "personal-schedule-planner@2026-08-04.v1";
export const PERSONAL_SCHEDULE_BIG_FIVE_VERSION = "big-five-short-20@2026-08-04";

export const PERSONAL_SCHEDULE_STATES = Object.freeze([
  "idle",
  "intake_in_progress",
  "intake_saved",
  "generation_pending",
  "generation_failed",
  "draft_ready",
  "validation_failed",
  "editing",
  "ready_to_import",
  "importing",
  "import_completed",
  "import_partially_failed",
  "rolled_back",
]);

export const PERSONAL_SCHEDULE_ANALYTICS_EVENTS = Object.freeze([
  "personal_schedule_opened",
  "personal_schedule_mode_selected",
  "personal_schedule_intake_started",
  "personal_schedule_intake_completed",
  "personal_schedule_big_five_skipped",
  "personal_schedule_generation_requested",
  "personal_schedule_generation_completed",
  "personal_schedule_generation_failed",
  "personal_schedule_variant_selected",
  "personal_schedule_draft_edited",
  "personal_schedule_import_confirmed",
  "personal_schedule_import_completed",
  "personal_schedule_import_rolled_back",
  "personal_schedule_adaptation_shown",
  "personal_schedule_adaptation_accepted",
  "personal_schedule_adaptation_declined",
]);

export const PERSONAL_SCHEDULE_ENTITLEMENT_FLAGS = Object.freeze([
  "personal_schedule_quick",
  "personal_schedule_deep",
  "personal_schedule_three_variants",
  "personal_schedule_ai_revisions",
  "personal_schedule_history",
  "personal_schedule_adaptation",
]);

const FACTORS = Object.freeze([
  "openness",
  "conscientiousness",
  "extraversion",
  "agreeableness",
  "emotional_sensitivity",
]);

export const PERSONAL_SCHEDULE_BIG_FIVE_QUESTIONS = Object.freeze([
  { id: "bf_c_01", factor: "conscientiousness", reverseScored: false, text: "Мне проще действовать, когда день заранее разложен по шагам." },
  { id: "bf_o_01", factor: "openness", reverseScored: false, text: "Мне интересно пробовать новые способы организовать день." },
  { id: "bf_e_01", factor: "extraversion", reverseScored: false, text: "Общение часто помогает мне включиться в дела." },
  { id: "bf_a_01", factor: "agreeableness", reverseScored: false, text: "Я стараюсь учитывать планы близких при выборе времени для дел." },
  { id: "bf_s_01", factor: "emotional_sensitivity", reverseScored: false, text: "При высокой нагрузке мне особенно нужны буферы и паузы." },
  { id: "bf_c_02", factor: "conscientiousness", reverseScored: true, text: "Если день расписан слишком подробно, я быстро перестаю следовать плану." },
  { id: "bf_o_02", factor: "openness", reverseScored: true, text: "Мне комфортнее один привычный способ планирования без экспериментов." },
  { id: "bf_e_02", factor: "extraversion", reverseScored: true, text: "После встреч мне обычно нужно больше времени на восстановление." },
  { id: "bf_a_02", factor: "agreeableness", reverseScored: true, text: "Я предпочитаю планировать свои дела без учета чужих ожиданий." },
  { id: "bf_s_02", factor: "emotional_sensitivity", reverseScored: true, text: "Даже плотный день редко влияет на мое спокойствие." },
  { id: "bf_c_03", factor: "conscientiousness", reverseScored: false, text: "Мне помогает видеть приоритеты и сроки рядом с задачами." },
  { id: "bf_o_03", factor: "openness", reverseScored: false, text: "Мне нравится оставлять место для творческих или нестандартных блоков." },
  { id: "bf_e_03", factor: "extraversion", reverseScored: false, text: "Мне удобно чередовать одиночные задачи и совместные активности." },
  { id: "bf_a_03", factor: "agreeableness", reverseScored: false, text: "Мне важно оставлять время для семьи, помощи и договоренностей." },
  { id: "bf_s_03", factor: "emotional_sensitivity", reverseScored: false, text: "Мне легче держать ритм, когда в расписании есть запасные окна." },
  { id: "bf_c_04", factor: "conscientiousness", reverseScored: true, text: "Списки и чек-листы обычно только мешают мне двигаться дальше." },
  { id: "bf_o_04", factor: "openness", reverseScored: true, text: "Новые форматы расписания чаще отвлекают меня, чем помогают." },
  { id: "bf_e_04", factor: "extraversion", reverseScored: true, text: "Я предпочитаю почти весь день планировать без социальных блоков." },
  { id: "bf_a_04", factor: "agreeableness", reverseScored: true, text: "Мне несложно отклонять просьбы, если они не вписаны в мой план." },
  { id: "bf_s_04", factor: "emotional_sensitivity", reverseScored: true, text: "Мне обычно подходит расписание без дополнительных переходов между делами." },
]);

const WEEKDAY_LABELS = Object.freeze({
  1: "Понедельник",
  2: "Вторник",
  3: "Среда",
  4: "Четверг",
  5: "Пятница",
  6: "Суббота",
  7: "Воскресенье",
});

const WEEKDAY_SHORTS = Object.freeze({
  пн: 1,
  вт: 2,
  ср: 3,
  чт: 4,
  пт: 5,
  сб: 6,
  вс: 7,
  mo: 1,
  tu: 2,
  we: 3,
  th: 4,
  fr: 5,
  sa: 6,
  su: 7,
});

const DEFAULT_GOALS = Object.freeze([
  { title: "Главное дело дня", category: "focus", priority: "high", timesPerWeek: 3, minimumMinutes: 45, desiredMinutes: 60, preferredTime: "morning", splittable: false },
  { title: "Движение или спорт", category: "sport", priority: "medium", timesPerWeek: 3, minimumMinutes: 30, desiredMinutes: 45, preferredTime: "evening", splittable: false },
  { title: "Домашние дела", category: "home", priority: "medium", timesPerWeek: 4, minimumMinutes: 25, desiredMinutes: 40, preferredTime: "day", splittable: true },
  { title: "Время для отдыха", category: "rest", priority: "high", timesPerWeek: 7, minimumMinutes: 45, desiredMinutes: 60, preferredTime: "evening", splittable: false },
]);

export function createDefaultPersonalScheduleState(now = new Date()) {
  return {
    schemaVersion: 1,
    status: "idle",
    promptVersion: PERSONAL_SCHEDULE_PROMPT_VERSION,
    lastOpenedAt: null,
    updatedAt: toIsoTimestamp(now),
    intake: createDefaultPersonalScheduleIntake(now),
    normalizedProfile: null,
    bigFive: {
      skipped: true,
      answers: {},
      scores: calculateBigFiveScores(null),
    },
    drafts: [],
    selectedDraftId: "",
    selectedVariantId: "",
    history: [],
    importBatches: [],
    adaptationSuggestions: [],
    lastError: null,
  };
}

export function createDefaultPersonalScheduleIntake(now = new Date()) {
  const today = toIsoDate(now);
  return {
    schemaVersion: 1,
    mode: "quick",
    period: {
      type: "typical_day",
      startDate: today,
      endDate: today,
      workdays: [1, 2, 3, 4, 5],
    },
    includeCalendar: true,
    sleep: {
      wakeTime: "07:30",
      bedTime: "23:00",
      minimumSleepMinutes: 420,
      recoveryMinutes: 30,
      windDownMinutes: 30,
      shiftWindowMinutes: 45,
    },
    work: {
      type: "fixed",
      startTime: "09:00",
      endTime: "18:00",
      workdays: [1, 2, 3, 4, 5],
      preparationMinutes: 30,
      commuteBeforeMinutes: 30,
      commuteAfterMinutes: 30,
    },
    goals: structuredCloneSafe(DEFAULT_GOALS),
    energy: {
      peak: "morning",
      density: "balanced",
      focusBlockMinutes: 60,
      breakMinutes: 10,
      maxHardBlocksInRow: 2,
      bufferMinutes: 15,
    },
    rest: {
      dailyFreeMinutes: 90,
      freeEveningsPerWeek: 2,
      screenFreeMinutes: 30,
      favoriteRest: "прогулка, чтение или спокойное время",
      protectRecoveryAfterHardDays: true,
      keepWeekendFlexible: true,
      avoidLateHardWork: true,
    },
  };
}

export function normalizePersonalScheduleState(source, now = new Date()) {
  const fallback = createDefaultPersonalScheduleState(now);
  if (!source || typeof source !== "object" || Array.isArray(source)) return fallback;
  const intake = normalizePersonalScheduleIntake(source.intake || fallback.intake, now);
  const answers = normalizeBigFiveAnswers(source.bigFive?.answers);
  const scores = source.bigFive?.scores && typeof source.bigFive.scores === "object"
    ? source.bigFive.scores
    : calculateBigFiveScores(answers);
  return {
    ...fallback,
    ...source,
    schemaVersion: 1,
    status: PERSONAL_SCHEDULE_STATES.includes(source.status) ? source.status : fallback.status,
    promptVersion: PERSONAL_SCHEDULE_PROMPT_VERSION,
    updatedAt: isIsoLike(source.updatedAt) ? source.updatedAt : fallback.updatedAt,
    intake,
    normalizedProfile: source.normalizedProfile && typeof source.normalizedProfile === "object"
      ? source.normalizedProfile
      : normalizePersonalScheduleProfile(intake, scores),
    bigFive: {
      skipped: source.bigFive?.skipped !== false,
      answers,
      scores,
    },
    drafts: Array.isArray(source.drafts) ? source.drafts.filter(Boolean) : [],
    importBatches: Array.isArray(source.importBatches) ? source.importBatches.filter(Boolean) : [],
    history: Array.isArray(source.history) ? source.history.filter(Boolean) : [],
    adaptationSuggestions: Array.isArray(source.adaptationSuggestions) ? source.adaptationSuggestions.filter(Boolean) : [],
    lastError: source.lastError && typeof source.lastError === "object" ? source.lastError : null,
  };
}

export function normalizePersonalScheduleIntake(source, now = new Date()) {
  const fallback = createDefaultPersonalScheduleIntake(now);
  const value = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  const periodType = ["typical_day", "work_week", "full_week", "custom"].includes(value.period?.type)
    ? value.period.type
    : fallback.period.type;
  const startDate = normalizeIsoDate(value.period?.startDate, fallback.period.startDate);
  const endDate = periodType === "custom"
    ? normalizeIsoDate(value.period?.endDate, startDate)
    : periodType === "typical_day"
      ? startDate
      : addDaysIso(startDate, periodType === "work_week" ? 4 : 6);

  return {
    schemaVersion: 1,
    mode: value.mode === "deep" ? "deep" : "quick",
    period: {
      type: periodType,
      startDate,
      endDate,
      workdays: normalizeWeekdays(value.period?.workdays, fallback.period.workdays),
    },
    includeCalendar: value.includeCalendar !== false,
    sleep: {
      wakeTime: normalizeTime(value.sleep?.wakeTime, fallback.sleep.wakeTime),
      bedTime: normalizeTime(value.sleep?.bedTime, fallback.sleep.bedTime),
      minimumSleepMinutes: clampInteger(value.sleep?.minimumSleepMinutes, 240, 720, fallback.sleep.minimumSleepMinutes),
      recoveryMinutes: clampInteger(value.sleep?.recoveryMinutes, 0, 180, fallback.sleep.recoveryMinutes),
      windDownMinutes: clampInteger(value.sleep?.windDownMinutes, 0, 180, fallback.sleep.windDownMinutes),
      shiftWindowMinutes: clampInteger(value.sleep?.shiftWindowMinutes, 0, 240, fallback.sleep.shiftWindowMinutes),
    },
    work: {
      type: ["fixed", "flexible", "shift", "irregular", "none"].includes(value.work?.type) ? value.work.type : fallback.work.type,
      startTime: normalizeTime(value.work?.startTime, fallback.work.startTime),
      endTime: normalizeTime(value.work?.endTime, fallback.work.endTime),
      workdays: normalizeWeekdays(value.work?.workdays, fallback.work.workdays),
      preparationMinutes: clampInteger(value.work?.preparationMinutes, 0, 180, fallback.work.preparationMinutes),
      commuteBeforeMinutes: clampInteger(value.work?.commuteBeforeMinutes, 0, 240, fallback.work.commuteBeforeMinutes),
      commuteAfterMinutes: clampInteger(value.work?.commuteAfterMinutes, 0, 240, fallback.work.commuteAfterMinutes),
    },
    goals: normalizeGoals(value.goals),
    energy: {
      peak: normalizeEnum(value.energy?.peak, ["early_morning", "morning", "day", "evening", "late_evening", "depends"], fallback.energy.peak),
      density: normalizeEnum(value.energy?.density, ["light", "balanced", "dense"], fallback.energy.density),
      focusBlockMinutes: clampInteger(value.energy?.focusBlockMinutes, 20, 180, fallback.energy.focusBlockMinutes),
      breakMinutes: clampInteger(value.energy?.breakMinutes, 5, 60, fallback.energy.breakMinutes),
      maxHardBlocksInRow: clampInteger(value.energy?.maxHardBlocksInRow, 1, 5, fallback.energy.maxHardBlocksInRow),
      bufferMinutes: clampInteger(value.energy?.bufferMinutes, 0, 90, fallback.energy.bufferMinutes),
    },
    rest: {
      dailyFreeMinutes: clampInteger(value.rest?.dailyFreeMinutes, 0, 360, fallback.rest.dailyFreeMinutes),
      freeEveningsPerWeek: clampInteger(value.rest?.freeEveningsPerWeek, 0, 7, fallback.rest.freeEveningsPerWeek),
      screenFreeMinutes: clampInteger(value.rest?.screenFreeMinutes, 0, 240, fallback.rest.screenFreeMinutes),
      favoriteRest: limitText(value.rest?.favoriteRest || fallback.rest.favoriteRest, 160),
      protectRecoveryAfterHardDays: value.rest?.protectRecoveryAfterHardDays !== false,
      keepWeekendFlexible: value.rest?.keepWeekendFlexible !== false,
      avoidLateHardWork: value.rest?.avoidLateHardWork !== false,
    },
  };
}

export function calculateBigFiveScores(answers, questions = PERSONAL_SCHEDULE_BIG_FIVE_QUESTIONS) {
  const normalizedAnswers = normalizeBigFiveAnswers(answers);
  const answeredCount = Object.keys(normalizedAnswers).length;
  const result = Object.fromEntries(FACTORS.map(factor => [factor, { average: null, count: 0 }]));
  if (!answeredCount) {
    return {
      version: PERSONAL_SCHEDULE_BIG_FIVE_VERSION,
      skipped: true,
      complete: false,
      answeredCount: 0,
      scores: result,
    };
  }

  for (const question of questions) {
    const value = normalizedAnswers[question.id];
    if (!value) continue;
    const score = question.reverseScored ? 6 - value : value;
    const current = result[question.factor];
    current.average = current.average === null
      ? score
      : roundTo(((current.average * current.count) + score) / (current.count + 1), 2);
    current.count += 1;
  }

  return {
    version: PERSONAL_SCHEDULE_BIG_FIVE_VERSION,
    skipped: false,
    complete: answeredCount >= questions.length,
    answeredCount,
    scores: result,
  };
}

export function normalizePersonalScheduleProfile(intake, bigFiveScores = null) {
  const normalizedIntake = normalizePersonalScheduleIntake(intake);
  const scores = bigFiveScores || calculateBigFiveScores(null);
  const focusBlock = normalizedIntake.energy.focusBlockMinutes;
  const density = normalizedIntake.energy.density;
  return {
    version: "personal-schedule-profile@2026-08-04.v1",
    mode: normalizedIntake.mode,
    periodType: normalizedIntake.period.type,
    planningStyle: density === "dense" ? "compact" : density === "light" ? "spacious" : "balanced",
    constraintsSummary: [
      `Пик энергии: ${getEnergyPeakLabel(normalizedIntake.energy.peak)}`,
      `Фокус-блок: ${focusBlock} минут`,
      `Буфер: ${normalizedIntake.energy.bufferMinutes} минут`,
      `Свободное время: ${normalizedIntake.rest.dailyFreeMinutes} минут в день`,
      scores.skipped ? "Big Five пропущен" : "Big Five учтен для стиля планирования",
    ],
    bigFive: scores,
  };
}

export function collectPersonalScheduleExistingIntervals({
  includeCalendar = true,
  schedules = [],
  reminders = [],
  birthdays = [],
} = {}) {
  if (!includeCalendar) return [];
  const intervals = [];

  for (const schedule of Array.isArray(schedules) ? schedules : []) {
    const category = normalizeCategory(schedule?.type || schedule?.category || "schedule");
    const days = Array.isArray(schedule?.dayTimes) ? schedule.dayTimes : [];
    days.forEach((day, dayIndex) => {
      const weekday = normalizeWeekdayLabel(day?.day) || ((dayIndex % 7) + 1);
      const times = Array.isArray(day?.times) ? day.times : [];
      times.forEach((range, rangeIndex) => {
        const parsed = parseTimeRange(range);
        if (!parsed) return;
        intervals.push({
          id: `schedule-${schedule.id || dayIndex}-${rangeIndex}`,
          source: "schedule",
          sourceId: String(schedule.id || ""),
          weekday,
          titleCategory: category,
          category,
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          startMinute: parsed.startMinute,
          endMinute: parsed.endMinute,
          flexibility: "fixed",
        });
      });
    });
  }

  for (const reminder of Array.isArray(reminders) ? reminders : []) {
    const date = new Date(reminder?.scheduledAt || reminder?.date || "");
    if (!Number.isFinite(date.getTime())) continue;
    const startMinute = date.getHours() * 60 + date.getMinutes();
    intervals.push({
      id: `reminder-${reminder.id || intervals.length}`,
      source: "reminder",
      sourceId: String(reminder.id || ""),
      weekday: getIsoWeekday(date),
      titleCategory: "reminder",
      category: "reminder",
      startTime: minutesToTime(startMinute),
      endTime: minutesToTime(Math.min(23 * 60 + 59, startMinute + 30)),
      startMinute,
      endMinute: Math.min(23 * 60 + 59, startMinute + 30),
      flexibility: "semi_flexible",
    });
  }

  for (const birthday of Array.isArray(birthdays) ? birthdays : []) {
    if (!birthday?.dateKey) continue;
    const date = new Date(`${birthday.dateKey}T09:00:00`);
    if (!Number.isFinite(date.getTime())) continue;
    intervals.push({
      id: `birthday-${birthday.id || intervals.length}`,
      source: "birthday",
      sourceId: String(birthday.id || ""),
      weekday: getIsoWeekday(date),
      titleCategory: "birthday",
      category: "birthday",
      startTime: "09:00",
      endTime: "09:30",
      startMinute: 540,
      endMinute: 570,
      flexibility: "flexible",
    });
  }

  return intervals.slice(0, 120);
}

export function createPersonalScheduleAiRequest({
  intake = createDefaultPersonalScheduleIntake(),
  bigFiveScores = null,
  existingIntervals = [],
  now = new Date(),
} = {}) {
  const normalizedIntake = normalizePersonalScheduleIntake(intake, now);
  const normalizedProfile = normalizePersonalScheduleProfile(normalizedIntake, bigFiveScores);
  return {
    promptVersion: PERSONAL_SCHEDULE_PROMPT_VERSION,
    requestedAt: toIsoTimestamp(now),
    mode: normalizedIntake.mode,
    period: normalizedIntake.period,
    intake: normalizedIntake,
    profile: normalizedProfile,
    constraints: {
      sleep: normalizedIntake.sleep,
      work: normalizedIntake.work,
      energy: normalizedIntake.energy,
      rest: normalizedIntake.rest,
      goals: normalizedIntake.goals.map(goal => ({
        category: goal.category,
        priority: goal.priority,
        timesPerWeek: goal.timesPerWeek,
        minimumMinutes: goal.minimumMinutes,
        desiredMinutes: goal.desiredMinutes,
        preferredTime: goal.preferredTime,
        splittable: goal.splittable,
      })),
      existingIntervals: normalizeExistingIntervals(existingIntervals),
    },
    privacy: {
      sendsDiary: false,
      sendsRawNotes: false,
      sendsPersonalEventTitles: false,
      sendsOnlyStructuredIntervals: true,
    },
  };
}

export function validatePersonalScheduleAiRequest(request) {
  const errors = [];
  if (!request || typeof request !== "object" || Array.isArray(request)) errors.push("request_invalid");
  if (request?.promptVersion !== PERSONAL_SCHEDULE_PROMPT_VERSION) errors.push("prompt_version_mismatch");
  if (!["quick", "deep"].includes(request?.mode)) errors.push("mode_invalid");
  if (!request?.period || typeof request.period !== "object") errors.push("period_missing");
  if (!request?.constraints || typeof request.constraints !== "object") errors.push("constraints_missing");
  if (request?.privacy?.sendsDiary !== false) errors.push("privacy_sends_diary");
  if (request?.privacy?.sendsRawNotes !== false) errors.push("privacy_sends_raw_notes");
  if (request?.privacy?.sendsPersonalEventTitles !== false) errors.push("privacy_sends_titles");
  return { ok: errors.length === 0, errors };
}

export function createDeterministicScheduleDraft({
  intake = createDefaultPersonalScheduleIntake(),
  bigFiveScores = null,
  existingIntervals = [],
  variantCount = 0,
  now = new Date(),
  createId = defaultCreateId,
} = {}) {
  const normalizedIntake = normalizePersonalScheduleIntake(intake, now);
  const count = clampInteger(variantCount || (normalizedIntake.mode === "deep" ? 3 : 1), 1, 3, 1);
  const profiles = [
    { id: "balanced", title: "Сбалансированный", offset: 0, reason: "Ровно распределяет фокус, быт и восстановление." },
    { id: "focused", title: "С фокус-утром", offset: -45, reason: "Ставит самые сложные блоки ближе к пику энергии." },
    { id: "spacious", title: "Свободнее", offset: 30, reason: "Оставляет больше переходов и снижает плотность." },
  ];
  const variants = profiles.slice(0, count).map(profile => {
    const blocks = createVariantBlocks({ intake: normalizedIntake, profile, createId });
    const validation = validatePersonalScheduleDraft({ draft: { blocks }, intake: normalizedIntake, existingIntervals });
    return {
      id: createId("personal-schedule-variant"),
      title: profile.title,
      summary: profile.reason,
      recommendationReason: profile.reason,
      blocks,
      validation,
    };
  });
  const recommendedVariantId = variants[0]?.id || "";
  return {
    id: createId("personal-schedule-draft"),
    status: "draft_ready",
    promptVersion: PERSONAL_SCHEDULE_PROMPT_VERSION,
    bigFiveVersion: PERSONAL_SCHEDULE_BIG_FIVE_VERSION,
    createdAt: toIsoTimestamp(now),
    intake: normalizedIntake,
    normalizedProfile: normalizePersonalScheduleProfile(normalizedIntake, bigFiveScores),
    variants,
    recommendedVariantId,
    selectedVariantId: recommendedVariantId,
  };
}

export function validatePersonalScheduleDraft({ draft, intake = createDefaultPersonalScheduleIntake(), existingIntervals = [] } = {}) {
  const normalizedIntake = normalizePersonalScheduleIntake(intake);
  const blocks = Array.isArray(draft?.blocks) ? draft.blocks : [];
  const blockingConflicts = [];
  const warnings = [];
  const validBlocks = [];

  blocks.forEach((block, index) => {
    const startMinute = Number.isFinite(block.startMinute) ? block.startMinute : parseTimeToMinutes(block.startTime);
    const endMinute = Number.isFinite(block.endMinute) ? block.endMinute : parseTimeToMinutes(block.endTime);
    const weekday = normalizeWeekdayLabel(block.weekday) || Number(block.weekday) || 1;
    if (!Number.isFinite(startMinute) || !Number.isFinite(endMinute) || endMinute <= startMinute) {
      blockingConflicts.push({ code: "invalid_time", blockId: block.id || `block-${index}` });
    } else {
      validBlocks.push({
        id: block.id || `block-${index}`,
        weekday,
        startMinute,
        endMinute,
      });
    }
    for (const interval of normalizeExistingIntervals(existingIntervals)) {
      if (interval.weekday !== weekday) continue;
      if (interval.flexibility !== "fixed") continue;
      if (rangesOverlap(startMinute, endMinute, interval.startMinute, interval.endMinute)) {
        blockingConflicts.push({
          code: "fixed_conflict",
          blockId: block.id || `block-${index}`,
          intervalId: interval.id,
        });
      }
    }
  });

  for (let firstIndex = 0; firstIndex < validBlocks.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < validBlocks.length; secondIndex += 1) {
      const first = validBlocks[firstIndex];
      const second = validBlocks[secondIndex];
      if (first.weekday !== second.weekday) continue;
      if (rangesOverlap(first.startMinute, first.endMinute, second.startMinute, second.endMinute)) {
        blockingConflicts.push({
          code: "draft_overlap",
          blockId: first.id,
          conflictingBlockId: second.id,
        });
      }
    }
  }

  const sleepMinutes = getSleepMinutes(normalizedIntake.sleep.bedTime, normalizedIntake.sleep.wakeTime);
  if (sleepMinutes < normalizedIntake.sleep.minimumSleepMinutes) {
    blockingConflicts.push({
      code: "sleep_below_minimum",
      sleepMinutes,
      minimumSleepMinutes: normalizedIntake.sleep.minimumSleepMinutes,
    });
  }

  if (!blocks.length) warnings.push({ code: "empty_draft" });
  return { ok: blockingConflicts.length === 0, blockingConflicts, warnings };
}

export function createPersonalScheduleImportBatch({
  draft,
  selectedVariantId = "",
  includeTasks = true,
  includeReminders = false,
  existingIntervals = [],
  now = new Date(),
  createId = defaultCreateId,
} = {}) {
  const variant = selectVariant(draft, selectedVariantId);
  if (!draft || !variant) {
    return { ok: false, errors: ["variant_missing"], batch: null };
  }
  const validation = validatePersonalScheduleDraft({
    draft: { blocks: variant.blocks },
    intake: draft.intake,
    existingIntervals,
  });
  if (!validation.ok) {
    return { ok: false, errors: validation.blockingConflicts.map(conflict => conflict.code), batch: null };
  }

  const createdAt = toIsoTimestamp(now);
  const schedule = createScheduleEntity({ draft, variant, now, createId });
  const tasks = includeTasks
    ? variant.blocks
      .filter(block => block.category !== "rest")
      .slice(0, 12)
      .map(block => ({
        id: createId("task"),
        title: block.title,
        done: false,
        createdAt,
        updatedAt: createdAt,
        source: "personal_schedule_planner",
        personalScheduleBlockId: block.id,
      }))
    : [];
  const reminders = includeReminders
    ? variant.blocks
      .filter(block => ["focus", "work", "study", "sport"].includes(block.category))
      .slice(0, 8)
      .map(block => ({
        id: createId("reminder"),
        title: block.title,
        scheduledAt: toReminderTimestamp(draft.intake?.period?.startDate, block.startTime),
        completed: false,
        createdAt,
        updatedAt: createdAt,
        source: "personal_schedule_planner",
        personalScheduleBlockId: block.id,
      }))
    : [];

  return {
    ok: true,
    errors: [],
    batch: {
      id: createId("personal-schedule-import"),
      status: "ready",
      createdAt,
      draftId: draft.id,
      variantId: variant.id,
      entities: {
        schedules: [schedule],
        tasks,
        reminders,
      },
      importedIds: {
        schedules: [schedule.id],
        tasks: tasks.map(task => task.id),
        reminders: reminders.map(reminder => reminder.id),
      },
    },
  };
}

export function applyPersonalScheduleImportBatch({
  batch,
  schedules = [],
  tasks = [],
  reminders = [],
  now = new Date(),
} = {}) {
  const nextBatch = {
    ...(batch || {}),
    status: "applied",
    appliedAt: toIsoTimestamp(now),
  };
  const entities = nextBatch.entities || {};
  return {
    status: "import_completed",
    schedules: mergeById(schedules, entities.schedules),
    tasks: mergeById(tasks, entities.tasks),
    reminders: mergeById(reminders, entities.reminders),
    batch: nextBatch,
  };
}

export function rollbackPersonalScheduleImportBatch({
  batch,
  schedules = [],
  tasks = [],
  reminders = [],
  now = new Date(),
} = {}) {
  const ids = batch?.importedIds || {
    schedules: (batch?.entities?.schedules || []).map(item => item.id),
    tasks: (batch?.entities?.tasks || []).map(item => item.id),
    reminders: (batch?.entities?.reminders || []).map(item => item.id),
  };
  const nextBatch = {
    ...(batch || {}),
    status: "rolled_back",
    rolledBackAt: toIsoTimestamp(now),
  };
  return {
    status: "rolled_back",
    schedules: removeById(schedules, ids.schedules),
    tasks: removeById(tasks, ids.tasks),
    reminders: removeById(reminders, ids.reminders),
    batch: nextBatch,
  };
}

export function validatePersonalScheduleAiResponse(response) {
  const errors = [];
  if (!response || typeof response !== "object" || Array.isArray(response)) errors.push("response_invalid");
  if (response?.promptVersion !== PERSONAL_SCHEDULE_PROMPT_VERSION) errors.push("prompt_version_mismatch");
  if (!Array.isArray(response?.variants)) errors.push("variants_missing");
  for (const variant of Array.isArray(response?.variants) ? response.variants : []) {
    const validation = validatePersonalScheduleDraft({
      draft: { blocks: variant.blocks },
      intake: response.intake,
    });
    if (!validation.ok) errors.push("variant_invalid");
  }
  return { ok: errors.length === 0, errors };
}

export function createMockPersonalScheduleProvider({ createId = defaultCreateId, now = () => new Date() } = {}) {
  return {
    provider: "mock",
    promptVersion: PERSONAL_SCHEDULE_PROMPT_VERSION,
    async generate(request) {
      const validation = validatePersonalScheduleAiRequest(request);
      if (!validation.ok) {
        return {
          status: "invalid_request",
          provider: "mock",
          promptVersion: PERSONAL_SCHEDULE_PROMPT_VERSION,
          errors: validation.errors,
        };
      }
      return {
        status: "draft_ready",
        provider: "mock",
        promptVersion: PERSONAL_SCHEDULE_PROMPT_VERSION,
        draft: createDeterministicScheduleDraft({
          intake: request.intake,
          existingIntervals: request.constraints?.existingIntervals,
          variantCount: request.mode === "deep" ? 3 : 1,
          now: now(),
          createId,
        }),
      };
    },
  };
}

export function getPersonalScheduleStateLabel(status) {
  return {
    idle: "Готов к настройке",
    intake_in_progress: "Опрос в процессе",
    intake_saved: "Ответы сохранены",
    generation_pending: "Готовим расписание",
    generation_failed: "Не удалось подготовить расписание",
    draft_ready: "Черновик готов",
    validation_failed: "Нужна проверка",
    editing: "Редактирование",
    ready_to_import: "Готово к добавлению",
    importing: "Добавляем в Focus",
    import_completed: "Добавлено",
    import_partially_failed: "Добавлено частично",
    rolled_back: "Импорт отменен",
  }[status] || "Готов к настройке";
}

export function getPersonalScheduleWeekdayLabel(weekday) {
  return WEEKDAY_LABELS[Number(weekday)] || WEEKDAY_LABELS[1];
}

export function parseTimeToMinutes(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return NaN;
  return hours * 60 + minutes;
}

function createVariantBlocks({ intake, profile, createId }) {
  const weekdays = getPeriodWeekdays(intake.period);
  const startBase = parseTimeToMinutes(intake.sleep.wakeTime) + 60 + profile.offset;
  const focusMinutes = intake.energy.focusBlockMinutes;
  const breakMinutes = intake.energy.breakMinutes;
  const buffer = intake.energy.bufferMinutes;
  const blocks = [];
  weekdays.slice(0, intake.period.type === "typical_day" ? 1 : 7).forEach((weekday, index) => {
    let cursor = clampInteger(startBase + (index % 2) * 15, 360, 1260, 540);
    const goals = intake.goals.length ? intake.goals : structuredCloneSafe(DEFAULT_GOALS);
    const primary = goals.find(goal => goal.priority === "high" && goal.category !== "rest") || goals[0];
    const primaryDuration = Math.max(primary.minimumMinutes, Math.min(primary.desiredMinutes, focusMinutes));
    const hasWorkBlock = intake.work.type !== "none" && intake.work.workdays.includes(weekday);
    const workStart = hasWorkBlock ? parseTimeToMinutes(intake.work.startTime) : NaN;
    const workEnd = hasWorkBlock ? parseTimeToMinutes(intake.work.endTime) : NaN;
    let primaryStart = cursor;
    if (
      hasWorkBlock &&
      Number.isFinite(workStart) &&
      Number.isFinite(workEnd) &&
      rangesOverlap(primaryStart, primaryStart + primaryDuration, workStart, workEnd)
    ) {
      const earliestFocusStart = parseTimeToMinutes(intake.sleep.wakeTime) + Math.max(15, intake.work.preparationMinutes);
      const latestPreWorkStart = workStart - primaryDuration;
      primaryStart = latestPreWorkStart >= earliestFocusStart
        ? latestPreWorkStart
        : workEnd + Math.max(buffer, intake.work.commuteAfterMinutes);
    }
    blocks.push(createBlock({
      createId,
      weekday,
      startMinute: primaryStart,
      duration: primaryDuration,
      title: primary.title,
      category: primary.category,
      priority: primary.priority,
      flexibility: "semi_flexible",
      rationale: getBlockRationale(primary, profile),
    }));
    cursor = primaryStart + primaryDuration + breakMinutes + buffer;

    if (hasWorkBlock) {
      blocks.push(createBlock({
        createId,
        weekday,
        startMinute: workStart,
        duration: Math.max(30, workEnd - workStart),
        title: "Рабочий блок",
        category: "work",
        priority: "high",
        flexibility: intake.work.type === "fixed" ? "fixed" : "semi_flexible",
        rationale: "Сохраняет обязательное рабочее окно.",
      }));
    }

    const restStart = Math.max(cursor, parseTimeToMinutes(intake.work.endTime) + 60);
    blocks.push(createBlock({
      createId,
      weekday,
      startMinute: clampInteger(restStart, 900, 1320, 1140),
      duration: Math.max(30, Math.min(90, intake.rest.dailyFreeMinutes)),
      title: "Восстановление",
      category: "rest",
      priority: "high",
      flexibility: "flexible",
      rationale: "Защищает энергию и снижает перегрузку.",
    }));
  });
  return blocks.sort((first, second) => first.weekday - second.weekday || first.startMinute - second.startMinute);
}

function createBlock({ createId, weekday, startMinute, duration, title, category, priority, flexibility, rationale }) {
  const safeStart = clampInteger(startMinute, 0, 1430, 540);
  const safeEnd = Math.min(1439, safeStart + Math.max(10, duration));
  return {
    id: createId("personal-schedule-block"),
    title: limitText(title, 120) || "Блок расписания",
    category: normalizeCategory(category),
    priority: normalizeEnum(priority, ["low", "medium", "high"], "medium"),
    weekday,
    weekdayLabel: getPersonalScheduleWeekdayLabel(weekday),
    startTime: minutesToTime(safeStart),
    endTime: minutesToTime(safeEnd),
    startMinute: safeStart,
    endMinute: safeEnd,
    flexibility: normalizeFlexibility(flexibility),
    rationale: limitText(rationale, 180),
  };
}

function createScheduleEntity({ draft, variant, now, createId }) {
  const createdAt = toIsoTimestamp(now);
  const groups = new Map();
  for (const block of variant.blocks) {
    const weekday = Number(block.weekday) || 1;
    if (!groups.has(weekday)) groups.set(weekday, []);
    groups.get(weekday).push(`${block.startTime}-${block.endTime} · ${block.title}`);
  }
  const dayTimes = [...groups.entries()]
    .sort(([first], [second]) => first - second)
    .map(([weekday, times]) => ({
      day: getPersonalScheduleWeekdayLabel(weekday),
      times,
    }));
  return {
    id: createId("schedule"),
    title: "Идеальное расписание",
    type: "personal",
    typeLabel: "Персональный план",
    isActive: true,
    reminder: "Без напоминаний",
    meta: `${variant.title} · ${variant.blocks.length} бл.`,
    note: `Создано через «Идеальное расписание». ${variant.recommendationReason || ""}`.trim(),
    dayTimes,
    details: {
      "Источник": "Идеальное расписание",
      "Версия": draft.promptVersion || PERSONAL_SCHEDULE_PROMPT_VERSION,
      "Создано": createdAt,
    },
    createdAt,
    updatedAt: createdAt,
    personalScheduleDraftId: draft.id,
    personalScheduleVariantId: variant.id,
  };
}

function normalizeGoals(goals) {
  const source = Array.isArray(goals) && goals.length ? goals : DEFAULT_GOALS;
  return source.slice(0, 24).map((goal, index) => ({
    id: String(goal.id || `goal-${index + 1}`),
    title: limitText(goal.title || DEFAULT_GOALS[index % DEFAULT_GOALS.length]?.title || "Цель", 120),
    category: normalizeCategory(goal.category || "goal"),
    priority: normalizeEnum(goal.priority, ["low", "medium", "high"], "medium"),
    timesPerWeek: clampInteger(goal.timesPerWeek, 1, 14, 1),
    minimumMinutes: clampInteger(goal.minimumMinutes, 10, 240, 30),
    desiredMinutes: clampInteger(goal.desiredMinutes, 10, 360, 45),
    preferredTime: normalizeEnum(goal.preferredTime, ["early_morning", "morning", "day", "evening", "late_evening", "depends"], "depends"),
    allowedWeekdays: normalizeWeekdays(goal.allowedWeekdays, [1, 2, 3, 4, 5, 6, 7]),
    skippable: goal.skippable === true,
    splittable: goal.splittable === true,
  }));
}

function normalizeBigFiveAnswers(answers) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return {};
  return Object.fromEntries(Object.entries(answers)
    .map(([key, value]) => [key, clampInteger(value, 1, 5, 0)])
    .filter(([, value]) => value >= 1 && value <= 5));
}

function normalizeExistingIntervals(intervals) {
  return (Array.isArray(intervals) ? intervals : []).map((interval, index) => {
    const startMinute = Number.isFinite(interval.startMinute) ? interval.startMinute : parseTimeToMinutes(interval.startTime);
    const endMinute = Number.isFinite(interval.endMinute) ? interval.endMinute : parseTimeToMinutes(interval.endTime);
    if (!Number.isFinite(startMinute) || !Number.isFinite(endMinute) || endMinute <= startMinute) return null;
    return {
      id: String(interval.id || `interval-${index}`),
      source: String(interval.source || "calendar"),
      sourceId: String(interval.sourceId || ""),
      weekday: normalizeWeekdayLabel(interval.weekday) || Number(interval.weekday) || 1,
      titleCategory: normalizeCategory(interval.titleCategory || interval.category || "event"),
      category: normalizeCategory(interval.category || interval.titleCategory || "event"),
      startTime: minutesToTime(startMinute),
      endTime: minutesToTime(endMinute),
      startMinute,
      endMinute,
      flexibility: normalizeFlexibility(interval.flexibility),
    };
  }).filter(Boolean).slice(0, 120);
}

function parseTimeRange(value) {
  const text = String(value || "");
  const match = text.match(/(\d{1,2}:\d{2})\s*(?:-|–|—|·|до)\s*(\d{1,2}:\d{2})/i);
  if (!match) return null;
  const startMinute = parseTimeToMinutes(match[1]);
  const endMinute = parseTimeToMinutes(match[2]);
  if (!Number.isFinite(startMinute) || !Number.isFinite(endMinute) || endMinute <= startMinute) return null;
  return {
    startTime: minutesToTime(startMinute),
    endTime: minutesToTime(endMinute),
    startMinute,
    endMinute,
  };
}

function normalizeWeekdayLabel(label) {
  if (Number.isInteger(Number(label)) && Number(label) >= 1 && Number(label) <= 7) return Number(label);
  const text = String(label || "").trim().toLowerCase();
  if (!text) return 0;
  const exact = Object.entries(WEEKDAY_LABELS).find(([, value]) => value.toLowerCase() === text);
  if (exact) return Number(exact[0]);
  return WEEKDAY_SHORTS[text.slice(0, 2)] || 0;
}

function getPeriodWeekdays(period) {
  if (period.type === "typical_day") return [getIsoWeekday(new Date(`${period.startDate}T00:00:00`)) || 1];
  if (period.type === "work_week") return normalizeWeekdays(period.workdays, [1, 2, 3, 4, 5]);
  if (period.type === "custom") {
    const days = [];
    const start = new Date(`${period.startDate}T00:00:00`);
    const end = new Date(`${period.endDate}T00:00:00`);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return [1, 2, 3, 4, 5, 6, 7];
    for (let date = new Date(start); date <= end && days.length < 14; date.setDate(date.getDate() + 1)) {
      days.push(getIsoWeekday(date));
    }
    return [...new Set(days)];
  }
  return [1, 2, 3, 4, 5, 6, 7];
}

function getBlockRationale(goal, profile) {
  if (goal.category === "rest") return "Восстанавливает энергию для следующего блока.";
  if (goal.preferredTime !== "depends") return "Учитывает желаемое время и длительность задачи.";
  if (profile.id === "focused") return "Сложная задача вынесена ближе к началу дня.";
  return "Поддерживает баланс между целью и восстановлением.";
}

function selectVariant(draft, selectedVariantId) {
  const variants = Array.isArray(draft?.variants) ? draft.variants : [];
  return variants.find(variant => variant.id === selectedVariantId)
    || variants.find(variant => variant.id === draft?.selectedVariantId)
    || variants[0]
    || null;
}

function mergeById(existing, incoming) {
  const result = Array.isArray(existing) ? [...existing] : [];
  for (const item of Array.isArray(incoming) ? incoming : []) {
    const index = result.findIndex(existingItem => existingItem.id === item.id);
    if (index >= 0) result[index] = item;
    else result.push(item);
  }
  return result;
}

function removeById(items, ids) {
  const set = new Set(Array.isArray(ids) ? ids : []);
  return (Array.isArray(items) ? items : []).filter(item => !set.has(item.id));
}

function rangesOverlap(firstStart, firstEnd, secondStart, secondEnd) {
  return firstStart < secondEnd && secondStart < firstEnd;
}

function getSleepMinutes(bedTime, wakeTime) {
  const bed = parseTimeToMinutes(bedTime);
  const wake = parseTimeToMinutes(wakeTime);
  if (!Number.isFinite(bed) || !Number.isFinite(wake)) return 0;
  return wake > bed ? wake - bed : (24 * 60 - bed) + wake;
}

function normalizeWeekdays(source, fallback) {
  const values = (Array.isArray(source) ? source : [])
    .map(value => Number(value))
    .filter(value => Number.isInteger(value) && value >= 1 && value <= 7);
  return values.length ? [...new Set(values)].sort((first, second) => first - second) : [...fallback];
}

function normalizeTime(value, fallback) {
  return Number.isFinite(parseTimeToMinutes(value)) ? String(value).padStart(5, "0") : fallback;
}

function minutesToTime(minutes) {
  const safe = clampInteger(minutes, 0, 1439, 0);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function normalizeEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function normalizeFlexibility(value) {
  return ["fixed", "semi_flexible", "flexible"].includes(value) ? value : "fixed";
}

function normalizeCategory(value) {
  const normalized = String(value || "event")
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-яё0-9_-]+/giu, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "event";
}

function getEnergyPeakLabel(value) {
  return {
    early_morning: "раннее утро",
    morning: "утро",
    day: "день",
    evening: "вечер",
    late_evening: "поздний вечер",
    depends: "зависит от дня",
  }[value] || "утро";
}

function toReminderTimestamp(startDate, startTime) {
  const date = normalizeIsoDate(startDate, toIsoDate(new Date()));
  return `${date}T${normalizeTime(startTime, "09:00")}:00.000`;
}

function addDaysIso(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return isoDate;
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function normalizeIsoDate(value, fallback) {
  const date = new Date(`${String(value || fallback)}T00:00:00`);
  return Number.isFinite(date.getTime()) ? toIsoDate(date) : fallback;
}

function isIsoLike(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value);
}

function toIsoDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "2026-08-04";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toIsoTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function getIsoWeekday(date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function clampInteger(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function limitText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function roundTo(value, precision) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function structuredCloneSafe(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function defaultCreateId(prefix = "personal-schedule") {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}
