import {
  PERSONAL_SCHEDULE_BIG_FIVE_QUESTIONS,
  PERSONAL_SCHEDULE_PROMPT_VERSION,
  applyPersonalScheduleImportBatch,
  calculateBigFiveScores,
  collectPersonalScheduleExistingIntervals,
  createDefaultPersonalScheduleState,
  createDeterministicScheduleDraft,
  createPersonalScheduleAiRequest,
  createPersonalScheduleImportBatch,
  cleanupPersonalScheduleImportedTasks,
  getPersonalScheduleStateLabel,
  getPersonalScheduleWeekdayLabel,
  normalizePersonalScheduleIntake,
  normalizePersonalScheduleProfile,
  normalizePersonalScheduleState,
  parseTimeToMinutes,
  rollbackPersonalScheduleImportBatch,
  validatePersonalScheduleDraft,
} from "./personal-schedule-planner.js";

const UI_STEPS = [
  "mode",
  "period",
  "calendar",
  "sleep",
  "work",
  "goals",
  "energy",
  "rest",
  "big-five-intro",
  "big-five-question",
  "review",
  "draft",
  "confirm-import",
  "history",
  "import-detail",
  "version-compare",
];

const INTAKE_STEPS = UI_STEPS.slice(0, UI_STEPS.indexOf("review") + 1);

const DEFAULT_IMPORT_OPTIONS = Object.freeze({
  includeTasks: false,
  includeReminders: false,
});

const QUICK_EDIT_MINUTES = 15;
const MIN_BLOCK_MINUTES = 15;
const MAX_DAY_MINUTE = 23 * 60 + 59;
const GOAL_CATEGORY_OPTIONS = Object.freeze([
  ["focus", "Глубокая работа"],
  ["work", "Работа"],
  ["study", "Учеба"],
  ["sport", "Движение"],
  ["home", "Дом"],
  ["family", "Семья"],
  ["health", "Здоровье"],
  ["creative", "Творчество"],
  ["rest", "Отдых"],
  ["goal", "Другая цель"],
]);
const GOAL_PRIORITY_OPTIONS = Object.freeze([
  ["high", "Очень важно"],
  ["medium", "Важно"],
  ["low", "Можно реже"],
]);
const GOAL_TIME_OPTIONS = Object.freeze([
  ["early_morning", "Раннее утро"],
  ["morning", "Утро"],
  ["day", "День"],
  ["evening", "Вечер"],
  ["late_evening", "Поздний вечер"],
  ["depends", "Без предпочтения"],
]);

export function createPersonalSchedulePlannerUi({
  storage,
  sync,
  getExistingData = () => ({}),
  setCollections = () => {},
  showStatus = () => {},
  escapeHtml: escape = defaultEscapeHtml,
  now = () => new Date(),
} = {}) {
  let state = withRuntimeDefaults(createDefaultPersonalScheduleState(now()));
  let openModal = null;
  let currentStep = "mode";
  let bigFiveIndex = 0;
  let selectedImportBatchId = "";
  let selectedCompareImportIds = { sourceBatchId: "", targetBatchId: "" };
  let bound = false;
  let lastStatus = {
    status: "idle",
    providerConfigured: false,
    provider: null,
    promptVersion: PERSONAL_SCHEDULE_PROMPT_VERSION,
    features: {},
  };
  let savingPromise = Promise.resolve();

  const load = async () => {
    try {
      const loaded = await storage?.loadPersonalSchedulePlanner?.();
      state = withRuntimeDefaults(normalizePersonalScheduleState(loaded, now()));
    } catch {
      state = withRuntimeDefaults(createDefaultPersonalScheduleState(now()));
    }
    renderFeatureCard();
    return state;
  };

  const save = () => {
    state = withRuntimeDefaults({
      ...state,
      updatedAt: now().toISOString(),
    });
    savingPromise = savingPromise
      .catch(() => null)
      .then(() => storage?.savePersonalSchedulePlanner?.(state))
      .catch(() => null);
    return savingPromise;
  };

  const setOpenModal = handler => {
    openModal = typeof handler === "function" ? handler : null;
  };

  const bind = () => {
    if (bound || typeof document === "undefined") return;
    bound = true;
    document.querySelector("#personalScheduleFeature")?.addEventListener("click", event => {
      const action = event.target.closest("[data-ps-feature-action]");
      if (!action) return;
      event.preventDefault();
      const value = action.dataset.psFeatureAction;
      if (value === "open-draft") {
        open("draft");
        return;
      }
      if (value === "history") {
        open("history");
        return;
      }
      if (value === "new") {
        startFreshIntake();
        open("mode");
        return;
      }
      open(getDefaultStepForState());
    });

    document.querySelector("#personalScheduleBody")?.addEventListener("click", handleBodyClick);
    document.querySelector("#personalScheduleBody")?.addEventListener("input", handleBodyInput);
    document.querySelector("#personalScheduleActions")?.addEventListener("click", handleActionClick);
  };

  const open = async (preferredStep = "") => {
    state = {
      ...state,
      status: state.status === "idle" ? "intake_in_progress" : state.status,
      lastOpenedAt: now().toISOString(),
    };
    currentStep = preferredStep || getDefaultStepForState();
    if (currentStep === "big-five-question") {
      bigFiveIndex = getNextBigFiveIndex();
    }
    await save();
    render();
    openModal?.("personalSchedule");
    refreshProviderStatus({ silent: true }).catch(() => render());
  };

  const renderFeatureCard = () => {
    if (typeof document === "undefined") return;
    const card = document.querySelector("#personalScheduleFeature");
    if (!card) return;
    const hasDraft = Boolean(getSelectedDraft());
    const hasImport = Boolean(getLastAppliedBatch());
    const statusLabel = getPersonalScheduleStateLabel(state.status);
    card.innerHTML = `
      <span class="icon icon-sparkles" aria-hidden="true"></span>
      <div class="personal-schedule-feature__main">
        <h3>Персональный ритм дня</h3>
        <p>Focus соберет редактируемый черновик из целей, занятых окон, энергии, сна, работы и отдыха.</p>
        <small>${escape(statusLabel)} · ${escape(state.promptVersion || PERSONAL_SCHEDULE_PROMPT_VERSION)}</small>
      </div>
      <div class="personal-schedule-feature__actions">
        ${hasDraft ? `<button class="secondary-button secondary-button--compact" type="button" data-ps-feature-action="open-draft">Открыть черновик</button>` : ""}
        ${hasDraft ? `<button class="secondary-button secondary-button--compact" type="button" data-ps-feature-action="continue">Продолжить</button>` : ""}
        ${hasImport ? `<button class="secondary-button secondary-button--compact" type="button" data-ps-feature-action="history">История</button>` : ""}
        <button class="primary-button primary-button--compact" type="button" data-ps-feature-action="new">${hasDraft ? "Новое расписание" : "Составить расписание"}</button>
      </div>
    `;
  };

  const render = () => {
    if (typeof document === "undefined") return;
    const title = document.querySelector("#personalScheduleTitle");
    const body = document.querySelector("#personalScheduleBody");
    const status = document.querySelector("#personalScheduleStatus");
    const actions = document.querySelector("#personalScheduleActions");
    if (!title || !body || !status || !actions) return;

    title.textContent = getTitleForStep(currentStep);
    status.textContent = getStatusText();
    body.innerHTML = renderStep();
    actions.innerHTML = renderActions();
    syncChoiceStates(body);
    renderFeatureCard();
  };

  const renderStep = () => {
    switch (currentStep) {
      case "mode":
        return renderModeStep();
      case "period":
        return renderPeriodStep();
      case "calendar":
        return renderCalendarStep();
      case "sleep":
        return renderSleepStep();
      case "work":
        return renderWorkStep();
      case "goals":
        return renderGoalsStep();
      case "energy":
        return renderEnergyStep();
      case "rest":
        return renderRestStep();
      case "big-five-intro":
        return renderBigFiveIntroStep();
      case "big-five-question":
        return renderBigFiveQuestionStep();
      case "review":
        return renderReviewStep();
      case "draft":
        return renderDraftStep();
      case "confirm-import":
        return renderConfirmImportStep();
      case "history":
        return renderHistoryStep();
      case "import-detail":
        return renderImportScheduleDetailStep();
      case "version-compare":
        return renderImportVersionCompareStep();
      default:
        return renderModeStep();
    }
  };

  const renderModeStep = () => `
    <div class="choice-grid personal-schedule-choice-grid">
      ${renderChoiceCard("quick", "Быстрый план", "Основные ограничения и один практичный вариант.", state.intake.mode === "quick", "data-ps-mode")}
      ${renderChoiceCard("deep", "Глубокий план", "Добавляет профиль предпочтений и до трех вариантов.", state.intake.mode === "deep", "data-ps-mode")}
    </div>
    <p class="scenario-note">Генерация идет через защищенный сервис Focus. Личные названия событий не отправляются.</p>
  `;

  const renderPeriodStep = () => {
    const period = state.intake.period;
    return `
      <div class="choice-grid personal-schedule-choice-grid">
        ${renderChoiceCard("typical_day", "Один день", "План на выбранную дату.", period.type === "typical_day", "data-ps-period")}
        ${renderChoiceCard("work_week", "Рабочая неделя", "Пять рабочих дней от даты начала.", period.type === "work_week", "data-ps-period")}
        ${renderChoiceCard("full_week", "Полная неделя", "Семь дней от даты начала.", period.type === "full_week", "data-ps-period")}
        ${renderChoiceCard("custom", "Свой период", "Точные даты начала и окончания.", period.type === "custom", "data-ps-period")}
      </div>
      <div class="modal-form-grid modal-form-grid--compact">
        ${renderInput("Дата начала", "period.startDate", period.startDate, "date")}
        ${renderInput("Дата окончания", "period.endDate", period.endDate, "date", period.type !== "custom")}
      </div>
      <div class="personal-schedule-review">
        <span class="modal-kicker">Рабочие дни</span>
        ${renderWeekdayPicker("period.workdays", period.workdays)}
      </div>
    `;
  };

  const renderCalendarStep = () => {
    const intervals = getExistingIntervals();
    return `
      <div class="choice-grid personal-schedule-choice-grid">
        ${renderChoiceCard("true", "Учитывать календарь Focus", "Передать только занятые интервалы без личных названий.", state.intake.includeCalendar, "data-ps-calendar")}
        ${renderChoiceCard("false", "Не учитывать календарь", "Составить только по ответам профиля.", !state.intake.includeCalendar, "data-ps-calendar")}
      </div>
      <div class="personal-schedule-review">
        <span class="modal-kicker">Приватность</span>
        <ul>
          <li>Структурированные интервалы: ${state.intake.includeCalendar ? intervals.length : 0}</li>
          <li>Дневник: не отправляется</li>
          <li>Сырые заметки: не отправляются</li>
          <li>Названия личных событий: не отправляются</li>
        </ul>
      </div>
    `;
  };

  const renderSleepStep = () => {
    const sleep = state.intake.sleep;
    return `
      <div class="modal-form-grid modal-form-grid--compact">
        ${renderInput("Подъем", "sleep.wakeTime", sleep.wakeTime, "time")}
        ${renderInput("Отбой", "sleep.bedTime", sleep.bedTime, "time")}
        ${renderInput("Минимум сна, минут", "sleep.minimumSleepMinutes", sleep.minimumSleepMinutes, "number")}
        ${renderInput("Буфер восстановления, минут", "sleep.recoveryMinutes", sleep.recoveryMinutes, "number")}
        ${renderInput("Замедление перед сном, минут", "sleep.windDownMinutes", sleep.windDownMinutes, "number")}
        ${renderInput("Окно сдвига сна, минут", "sleep.shiftWindowMinutes", sleep.shiftWindowMinutes, "number")}
      </div>
      <p class="scenario-note">Проверка блокирует черновики, которые опускают сон ниже заданного минимума.</p>
    `;
  };

  const renderWorkStep = () => {
    const work = state.intake.work;
    return `
      <div class="choice-grid personal-schedule-choice-grid">
        ${renderChoiceCard("fixed", "Фиксированная работа", "Защитить точное рабочее окно.", work.type === "fixed", "data-ps-work-type")}
        ${renderChoiceCard("flexible", "Гибкая работа", "Оставить работу, но дать планировщику выбрать место.", work.type === "flexible", "data-ps-work-type")}
        ${renderChoiceCard("shift", "Сменный график", "Учесть меняющийся или ротационный режим.", work.type === "shift", "data-ps-work-type")}
        ${renderChoiceCard("irregular", "Нерегулярно", "Использовать мягкие рабочие ограничения.", work.type === "irregular", "data-ps-work-type")}
        ${renderChoiceCard("none", "Без рабочего блока", "Не добавлять рабочий блок.", work.type === "none", "data-ps-work-type")}
      </div>
      <div class="modal-form-grid modal-form-grid--compact">
        ${renderInput("Начало", "work.startTime", work.startTime, "time", work.type === "none")}
        ${renderInput("Конец", "work.endTime", work.endTime, "time", work.type === "none")}
        ${renderInput("Подготовка, минут", "work.preparationMinutes", work.preparationMinutes, "number", work.type === "none")}
        ${renderInput("Дорога до, минут", "work.commuteBeforeMinutes", work.commuteBeforeMinutes, "number", work.type === "none")}
        ${renderInput("Дорога после, минут", "work.commuteAfterMinutes", work.commuteAfterMinutes, "number", work.type === "none")}
      </div>
      <div class="personal-schedule-review">
        <span class="modal-kicker">Рабочие дни</span>
        ${renderWeekdayPicker("work.workdays", work.workdays)}
      </div>
    `;
  };

  const renderGoalsStep = () => {
    const goals = Array.isArray(state.intake.goals) && state.intake.goals.length
      ? state.intake.goals
      : createDefaultPersonalScheduleState(now()).intake.goals;
    return `
      <section class="personal-schedule-goals" aria-label="Приоритетные цели">
        <header class="personal-schedule-goals__head">
          <div>
            <span class="modal-kicker">Цели для ритма</span>
            <p>Focus распределит эти направления по неделе с учетом энергии, работы, сна и отдыха.</p>
          </div>
          <button class="secondary-button secondary-button--compact" type="button" data-ps-goal-action="add" ${goals.length >= 24 ? "disabled" : ""}>Добавить цель</button>
        </header>
        <div class="personal-schedule-goal-list">
          ${goals.map((goal, index) => renderGoalEditor(goal, index, goals.length)).join("")}
        </div>
      </section>
    `;
  };

  const renderEnergyStep = () => {
    const energy = state.intake.energy;
    return `
      <section class="personal-schedule-energy">
        <header class="personal-schedule-energy__head">
          <span class="modal-kicker">Темп дня</span>
          <p>Эти настройки говорят Focus, когда ставить сложные дела, сколько держать фокус и какой запас оставлять между блоками.</p>
        </header>
        <div class="personal-schedule-energy-map" aria-label="Как эти настройки влияют на расписание">
          ${renderEnergyRule("Пик энергии", "Сюда планировщик двигает главные и сложные цели.")}
          ${renderEnergyRule("Плотность", "Определяет, будет день свободнее или заполненнее.")}
          ${renderEnergyRule("Фокус-блок", "Длина одного непрерывного блока сложной работы.")}
          ${renderEnergyRule("Буфер", "Запас на переключение, дорогу и восстановление.")}
        </div>
        <div class="personal-schedule-energy-fields">
          ${renderEnergySelect("Лучшее время для сложных дел", "energy.peak", energy.peak, [
          ["early_morning", "Раннее утро"],
          ["morning", "Утро"],
          ["day", "День"],
          ["evening", "Вечер"],
          ["late_evening", "Поздний вечер"],
          ["depends", "Зависит от дня"],
        ], "К этому окну будут ближе фокус и важные цели.")}
          ${renderEnergySelect("Насколько плотно заполнять день", "energy.density", energy.density, [
          ["light", "Свободно"],
          ["balanced", "Сбалансированно"],
          ["dense", "Плотно"],
        ], "Свободно оставит больше пустых окон, плотно соберет дела ближе друг к другу.")}
          ${renderEnergyInput("Длина одного фокус-блока, минут", "energy.focusBlockMinutes", energy.focusBlockMinutes, "Сколько минут держать сложную задачу без дробления.")}
          ${renderEnergyInput("Минимальный перерыв после блока, минут", "energy.breakMinutes", energy.breakMinutes, "Пауза после фокуса, спорта или другой нагрузки.")}
          ${renderEnergyInput("Сложных блоков подряд максимум", "energy.maxHardBlocksInRow", energy.maxHardBlocksInRow, "После этого Focus старается вставить отдых или простое дело.")}
          ${renderEnergyInput("Запас между делами, минут", "energy.bufferMinutes", energy.bufferMinutes, "Переходы, переключение контекста и небольшой резерв.")}
        </div>
      </section>
    `;
  };

  const renderRestStep = () => {
    const rest = state.intake.rest;
    return `
      <div class="modal-form-grid modal-form-grid--compact">
        ${renderInput("Свободное время в день, минут", "rest.dailyFreeMinutes", rest.dailyFreeMinutes, "number")}
        ${renderInput("Свободных вечеров в неделю", "rest.freeEveningsPerWeek", rest.freeEveningsPerWeek, "number")}
        ${renderInput("Время без экрана, минут", "rest.screenFreeMinutes", rest.screenFreeMinutes, "number")}
        ${renderInput("Любимый отдых", "rest.favoriteRest", rest.favoriteRest, "text")}
      </div>
      <div class="personal-schedule-consent">
        ${renderCheckbox("Защищать восстановление после тяжелых дней", "rest.protectRecoveryAfterHardDays", rest.protectRecoveryAfterHardDays)}
        ${renderCheckbox("Оставлять выходные гибкими", "rest.keepWeekendFlexible", rest.keepWeekendFlexible)}
        ${renderCheckbox("Избегать сложной работы поздно вечером", "rest.avoidLateHardWork", rest.avoidLateHardWork)}
      </div>
    `;
  };

  const renderBigFiveIntroStep = () => `
    <div class="personal-schedule-review">
      <h3>Профиль предпочтений</h3>
      <p>Двадцать коротких ответов не меняют ваши цели и рабочие часы. Они помогают выбрать стиль черновика: больше структуры или свободы, больше буферов, больше гибкости и места для совместных дел.</p>
    </div>
    <div class="choice-grid personal-schedule-choice-grid">
      ${renderChoiceCard("start", "Ответить на вопросы", "Использовать короткий профиль Big Five для этого плана.", !state.bigFive.skipped, "data-ps-big-five")}
      ${renderChoiceCard("skip", "Пропустить", "Составить без оценок предпочтений.", state.bigFive.skipped, "data-ps-big-five")}
    </div>
  `;

  const renderBigFiveQuestionStep = () => {
    const question = PERSONAL_SCHEDULE_BIG_FIVE_QUESTIONS[bigFiveIndex] || PERSONAL_SCHEDULE_BIG_FIVE_QUESTIONS[0];
    const value = Number(state.bigFive.answers[question.id]) || 0;
    return `
      <div class="personal-schedule-review">
        <span class="modal-kicker">Вопрос ${bigFiveIndex + 1} из ${PERSONAL_SCHEDULE_BIG_FIVE_QUESTIONS.length}</span>
        <h3>${escape(question.text)}</h3>
      </div>
      <div class="personal-schedule-scale" role="radiogroup" aria-label="Шкала ответа">
        ${[1, 2, 3, 4, 5].map(score => `
          <button class="${score === value ? "is-selected" : ""}" type="button" data-ps-big-five-score="${score}" aria-pressed="${String(score === value)}">
            <strong>${score}</strong>
            <span>${escape(getBigFiveScoreLabel(score))}</span>
          </button>
        `).join("")}
      </div>
      <label class="field-block">
        <span>Комментарий, если нужен</span>
        <textarea data-ps-big-five-note rows="3" maxlength="500">${escape(state.bigFive.answers[`${question.id}:note`] || "")}</textarea>
      </label>
    `;
  };

  const renderReviewStep = () => {
    const existing = getExistingIntervals();
    const profile = normalizePersonalScheduleProfile(state.intake, state.bigFive.scores);
    return `
      <div class="personal-schedule-review">
        <h3>Проверка запроса</h3>
        <ul>
          <li>Режим: ${escape(getModeLabel(state.intake.mode))}</li>
          <li>Период: ${escape(getPeriodTypeLabel(state.intake.period.type))} (${escape(state.intake.period.startDate)} - ${escape(state.intake.period.endDate)})</li>
          <li>Цели: ${state.intake.goals.length}</li>
          <li>Интервалы календаря: ${state.intake.includeCalendar ? existing.length : 0}</li>
          <li>Big Five: ${state.bigFive.skipped ? "пропущен" : `${state.bigFive.scores.answeredCount} ответов`}</li>
        </ul>
      </div>
      <div class="personal-schedule-review">
        <span class="modal-kicker">Как составляется</span>
        <ul>
          <li>Промпт: ${escape(PERSONAL_SCHEDULE_PROMPT_VERSION)}</li>
          <li>Дневник: не отправляется</li>
          <li>Сырые заметки: не отправляются</li>
          <li>Названия личных событий: не отправляются</li>
          <li>Стиль профиля: ${escape(getPlanningStyleLabel(profile.planningStyle))}</li>
        </ul>
      </div>
      ${state.lastError ? `<div class="voice-status voice-status--bad">${escape(state.lastError.message)}</div>` : ""}
      ${lastStatus.status === "offline" ? `<div class="voice-status voice-status--warn">Сервис генерации сейчас недоступен. Если он не ответит, Focus соберет локальный черновик на устройстве.</div>` : ""}
    `;
  };

  const renderDraftStep = () => {
    const draft = getSelectedDraft();
    const variant = getSelectedVariant(draft);
    if (!draft || !variant) {
      return `
        <div class="personal-schedule-review">
          <strong>Черновика пока нет.</strong>
          <span>Заполните анкету и сгенерируйте расписание.</span>
        </div>
      `;
    }
    const validation = validatePersonalScheduleDraft({
      draft: { blocks: variant.blocks },
      intake: draft.intake,
      existingIntervals: getExistingIntervalsForDraft(draft),
    });
    variant.validation = validation;
    const blocks = sortDraftBlocks(variant.blocks || []);
    return `
      <div class="personal-schedule-draft">
        <div class="personal-schedule-variants" aria-label="Варианты расписания">
          ${(draft.variants || []).map(item => `
            <button class="${item.id === variant.id ? "is-selected" : ""}" type="button" data-ps-variant="${escape(item.id)}" aria-pressed="${String(item.id === variant.id)}">
              <strong>${escape(item.title || "Вариант")}</strong>
              <span>${escape(item.summary || item.recommendationReason || "")}</span>
              ${item.id === draft.recommendedVariantId ? "<small>Рекомендовано</small>" : ""}
            </button>
          `).join("")}
        </div>
        <div class="personal-schedule-review">
          <span class="modal-kicker">Проверка</span>
          <span class="schedule-status-pill ${validation.ok ? "is-active" : ""}">${validation.ok ? "Готово" : "Нужны правки"}</span>
          ${validation.ok ? "" : renderValidationIssues(validation)}
        </div>
        ${renderDraftOverview(draft, variant, validation, blocks)}
        <div class="personal-schedule-block-editor" aria-label="Редактор блоков">
          <div class="personal-schedule-block-editor__head">
            <span class="modal-kicker">Блоки</span>
            <span>${blocks.length} шт.</span>
          </div>
          ${blocks.length ? blocks.map(block => renderDraftBlockEditor(block, blocks.length)).join("") : `<p class="modal-hint">В черновике пока нет блоков.</p>`}
        </div>
      </div>
    `;
  };

  const renderConfirmImportStep = () => {
    const draft = getSelectedDraft();
    const variant = getSelectedVariant(draft);
    const batchPreview = draft && variant
      ? createPersonalScheduleImportBatch({
        draft,
        selectedVariantId: variant.id,
        includeTasks: state.importOptions.includeTasks,
        includeReminders: state.importOptions.includeReminders,
        existingIntervals: getExistingIntervalsForDraft(draft),
        now: now(),
      })
      : { ok: false, batch: null };
    const entities = batchPreview.batch?.entities || { schedules: [], tasks: [], reminders: [] };
    const blocks = Array.isArray(variant?.blocks) ? variant.blocks : [];
    return `
      <div class="personal-schedule-review">
        <h3>Что попадёт в Focus</h3>
        <p>По умолчанию добавляется одно расписание с блоками по дням. Задачи и напоминания остаются выключенными, чтобы не заполнять сегодняшние дела лишними карточками.</p>
        ${renderImportReplacementNotice(draft)}
        ${renderImportConfirmationPlan({ draft, variant, blocks, entities })}
        ${renderImportImpactList(entities)}
        ${batchPreview.ok ? "" : renderValidationErrors(batchPreview.errors || ["validation_failed"])}
      </div>
      <div class="personal-schedule-consent">
        ${renderImportCheckbox("Дополнительно создать задачи из блоков", "includeTasks", state.importOptions.includeTasks)}
        ${renderImportCheckbox("Создать напоминания для сложных блоков", "includeReminders", state.importOptions.includeReminders)}
      </div>
    `;
  };

  const renderHistoryStep = () => {
    const appliedBatches = state.importBatches.filter(batch => batch.status === "applied" || batch.status === "rolled_back");
    const latestBatch = appliedBatches[0] || null;
    const importedTaskCount = getImportedTaskCleanupCount();
    return `
      <div class="personal-schedule-history">
        <div class="personal-schedule-history__header">
          <h3>История ритма дня</h3>
          <div class="personal-schedule-feature__actions">
            ${importedTaskCount ? `<button class="secondary-button secondary-button--danger" type="button" data-ps-action="cleanup-imported-tasks">Убрать задачи ритма (${importedTaskCount})</button>` : ""}
            <button class="secondary-button secondary-button--danger" type="button" data-ps-action="delete-profile">Очистить профиль</button>
            <button class="secondary-button secondary-button--danger" type="button" data-ps-action="delete-history">Очистить историю</button>
          </div>
        </div>
        ${importedTaskCount ? `<p class="modal-hint">Можно убрать только задачи, созданные импортом ритма. Расписание, напоминания и личные задачи останутся.</p>` : ""}
        ${latestBatch ? renderLatestImportResult(latestBatch) : ""}
        <div>
          <span class="modal-kicker">Черновики</span>
          ${(state.drafts || []).length ? `<div class="personal-schedule-history__list">${state.drafts.map(draft => `
              <article>
                <div>
                  <strong>${escape(draft.variants?.[0]?.title || "Черновик")}</strong>
                  <span>${escape(formatDateTime(draft.createdAt))} · ${escape(draft.promptVersion || PERSONAL_SCHEDULE_PROMPT_VERSION)}</span>
                </div>
                <button class="secondary-button secondary-button--compact" type="button" data-ps-open-draft="${escape(draft.id)}">Открыть</button>
              </article>
            `).join("")}</div>` : `<p class="modal-hint">Сохраненных черновиков пока нет.</p>`}
        </div>
        <div>
          <span class="modal-kicker">Импорты</span>
          ${appliedBatches.length ? `<div class="personal-schedule-history__list">${appliedBatches.map(renderImportHistoryRow).join("")}</div>` : `<p class="modal-hint">Импортов пока нет.</p>`}
        </div>
      </div>
    `;
  };

  const renderImportScheduleDetailStep = () => {
    const batch = getSelectedImportBatch();
    const schedule = getImportBatchPrimarySchedule(batch);
    const dayTimes = getImportScheduleDayTimes(schedule);
    if (!batch || !schedule || !dayTimes.length) {
      return `
        <div class="personal-schedule-review">
          <strong>Сохраненный ритм не найден.</strong>
          <span>Вернитесь к истории и выберите импорт, в котором есть расписание.</span>
        </div>
      `;
    }
    const blockCount = getImportScheduleBlockCount(dayTimes);
    const counts = getImportBatchEntityCounts(batch);
    return `
      <section class="personal-schedule-import-detail" aria-label="Полный ритм дня">
        <header class="personal-schedule-import-detail__head">
          <div>
            <span class="modal-kicker">Сохраненный ритм</span>
            <h3>${escape(schedule.title || "Персональный ритм дня")}</h3>
            <p>Все дни и блоки из выбранного импорта. Это версия расписания, которую Focus сохранил после опроса.</p>
          </div>
          <div class="personal-schedule-import-detail__metrics" aria-label="Сводка расписания">
            ${renderImportDetailMetric("Дни", formatImportCount(dayTimes.length, ["день", "дня", "дней"]))}
            ${renderImportDetailMetric("Блоки", formatImportCount(blockCount, ["блок", "блока", "блоков"]))}
            ${renderImportDetailMetric("Статус", getImportStatusLabel(batch))}
          </div>
        </header>
        ${schedule.meta ? `<p class="personal-schedule-import-detail__meta">${escape(schedule.meta)}</p>` : ""}
        ${renderImportVersionTrail(batch)}
        <div class="personal-schedule-import-detail__days" aria-label="Все дни расписания">
          ${dayTimes.map(renderImportScheduleDetailDay).join("")}
        </div>
        <footer class="personal-schedule-import-detail__footer">
          <span>${escape(formatImportScheduleScope(dayTimes.length, blockCount))} · задач: ${escape(String(counts.tasks))} · напоминаний: ${escape(String(counts.reminders))}</span>
          <div class="personal-schedule-import-detail__actions">
            ${renderCompareImportVersionsButton(batch, "Сравнить версии")}
            <button class="secondary-button secondary-button--compact" type="button" data-ps-copy-import-draft="${escape(batch.id)}">Сделать копию для правки</button>
            ${batch.status === "applied" ? `<button class="secondary-button secondary-button--compact" type="button" data-ps-rollback="${escape(batch.id)}">Откатить импорт</button>` : ""}
          </div>
        </footer>
      </section>
    `;
  };

  const renderImportVersionCompareStep = () => {
    const { sourceBatch, targetBatch } = getSelectedCompareImportBatches();
    const comparison = compareImportScheduleVersions(sourceBatch, targetBatch);
    if (!comparison) {
      return `
        <div class="personal-schedule-review">
          <strong>Пара версий не найдена.</strong>
          <span>Вернитесь к истории и выберите сравнение у замененной версии ритма.</span>
        </div>
      `;
    }
    return `
      <section class="personal-schedule-version-compare" aria-label="Сравнение версий ритма">
        <header class="personal-schedule-version-compare__head">
          <div>
            <span class="modal-kicker">Сравнение версий</span>
            <h3>Что изменилось в ритме</h3>
            <p>Старая версия сравнивается с новой по дням, времени и названию блоков. Это помогает быстро понять, что изменилось после правки.</p>
          </div>
          <div class="personal-schedule-version-compare__metrics" aria-label="Сводка изменений">
            ${renderImportDetailMetric("Старая", formatImportScheduleScope(comparison.source.dayCount, comparison.source.blockCount))}
            ${renderImportDetailMetric("Новая", formatImportScheduleScope(comparison.target.dayCount, comparison.target.blockCount))}
            ${renderImportDetailMetric("Изменения", formatImportCount(comparison.changeCount, ["изменение", "изменения", "изменений"]))}
          </div>
        </header>
        <div class="personal-schedule-version-compare__summary">
          <article>
            <span>Было</span>
            <strong>${escape(formatDateTime(sourceBatch.appliedAt || sourceBatch.createdAt))}</strong>
            <small>${escape(getImportBatchPrimarySchedule(sourceBatch)?.meta || getImportStatusLabel(sourceBatch))}</small>
          </article>
          <article>
            <span>Стало</span>
            <strong>${escape(formatDateTime(targetBatch.appliedAt || targetBatch.createdAt))}</strong>
            <small>${escape(getImportBatchPrimarySchedule(targetBatch)?.meta || getImportStatusLabel(targetBatch))}</small>
          </article>
        </div>
        <div class="personal-schedule-version-compare__groups">
          ${renderImportVersionCompareGroup("Добавлено", comparison.added, "Новых блоков нет.")}
          ${renderImportVersionCompareGroup("Убрано", comparison.removed, "Удаленных блоков нет.")}
          ${renderImportVersionCompareGroup("Изменено", comparison.changed, "Измененных блоков нет.")}
        </div>
      </section>
    `;
  };

  const renderActions = () => {
    if (state.status === "generation_pending" || state.status === "importing") {
      return `<button class="secondary-button" type="button" disabled>Выполняется</button>`;
    }
    if (currentStep === "draft") {
      const hasDraft = Boolean(getSelectedDraft());
      const validation = getSelectedDraftValidation();
      const canImport = hasDraft && validation?.ok;
      return `
        <button class="secondary-button" type="button" data-ps-action="back">Назад</button>
        <button class="secondary-button" type="button" data-ps-action="regenerate">Сгенерировать заново</button>
        <button class="primary-button" type="button" data-ps-action="confirm-import" ${canImport ? "" : "disabled"}>Добавить в Focus</button>
      `;
    }
    if (currentStep === "confirm-import") {
      return `
        <button class="secondary-button" type="button" data-ps-action="back">Назад</button>
        <button class="primary-button" type="button" data-ps-action="import">Импортировать</button>
      `;
    }
    if (currentStep === "history") {
      return getSelectedDraft()
        ? `<button class="secondary-button" type="button" data-ps-action="draft">Открыть черновик</button>`
        : `<button class="secondary-button" type="button" data-ps-action="back">Назад</button>`;
    }
    if (currentStep === "import-detail") {
      return `<button class="secondary-button" type="button" data-ps-action="history">К истории</button>`;
    }
    if (currentStep === "version-compare") {
      return `<button class="secondary-button" type="button" data-ps-action="history">К истории</button>`;
    }
    if (currentStep === "review") {
      return `
        <button class="secondary-button" type="button" data-ps-action="back">Назад</button>
        <button class="primary-button" type="button" data-ps-action="generate">Сгенерировать расписание</button>
      `;
    }
    if (currentStep === "big-five-question") {
      return `
        <button class="secondary-button" type="button" data-ps-action="back">Назад</button>
        <button class="primary-button" type="button" data-ps-action="next-big-five">${bigFiveIndex + 1 >= PERSONAL_SCHEDULE_BIG_FIVE_QUESTIONS.length ? "Готово" : "Дальше"}</button>
      `;
    }
    const backDisabled = currentStep === "mode" ? " disabled" : "";
    return `
      <button class="secondary-button" type="button" data-ps-action="back"${backDisabled}>Назад</button>
      <button class="primary-button" type="button" data-ps-action="next">Дальше</button>
    `;
  };

  const handleBodyClick = event => {
    const mode = event.target.closest("[data-ps-mode]");
    if (mode) {
      setPath("mode", mode.dataset.psMode);
      save();
      render();
      return;
    }

    const period = event.target.closest("[data-ps-period]");
    if (period) {
      setPath("period.type", period.dataset.psPeriod);
      applyPeriodDefaults();
      save();
      render();
      return;
    }

    const calendar = event.target.closest("[data-ps-calendar]");
    if (calendar) {
      setPath("includeCalendar", calendar.dataset.psCalendar === "true");
      save();
      render();
      return;
    }

    const workType = event.target.closest("[data-ps-work-type]");
    if (workType) {
      setPath("work.type", workType.dataset.psWorkType);
      save();
      render();
      return;
    }

    const weekday = event.target.closest("[data-ps-weekday]");
    if (weekday) {
      toggleWeekday(weekday.dataset.psWeekdayPath, Number(weekday.dataset.psWeekday));
      save();
      render();
      return;
    }

    const goalAction = event.target.closest("[data-ps-goal-action]");
    if (goalAction) {
      applyGoalAction(goalAction.dataset.psGoalAction, Number(goalAction.dataset.psGoalIndex));
      save();
      render();
      return;
    }

    const bigFiveChoice = event.target.closest("[data-ps-big-five]");
    if (bigFiveChoice) {
      if (bigFiveChoice.dataset.psBigFive === "skip") {
        state.bigFive = { skipped: true, answers: {}, scores: calculateBigFiveScores(null) };
        currentStep = "review";
      } else {
        state.bigFive = {
          ...state.bigFive,
          skipped: false,
          scores: calculateBigFiveScores(state.bigFive.answers),
        };
        bigFiveIndex = getNextBigFiveIndex();
        currentStep = "big-five-question";
      }
      save();
      render();
      return;
    }

    const bigFiveScore = event.target.closest("[data-ps-big-five-score]");
    if (bigFiveScore) {
      const question = PERSONAL_SCHEDULE_BIG_FIVE_QUESTIONS[bigFiveIndex];
      if (!question) return;
      state.bigFive = {
        ...state.bigFive,
        skipped: false,
        answers: {
          ...state.bigFive.answers,
          [question.id]: Number(bigFiveScore.dataset.psBigFiveScore),
        },
      };
      state.bigFive.scores = calculateBigFiveScores(state.bigFive.answers);
      save();
      render();
      return;
    }

    const variant = event.target.closest("[data-ps-variant]");
    if (variant) {
      state.selectedVariantId = variant.dataset.psVariant;
      const draft = getSelectedDraft();
      if (draft) draft.selectedVariantId = state.selectedVariantId;
      state.status = "draft_ready";
      save();
      render();
      return;
    }

    const blockAction = event.target.closest("[data-ps-block-action]");
    if (blockAction) {
      applyDraftBlockAction(blockAction.dataset.psBlockId, blockAction.dataset.psBlockAction);
      save();
      render();
      return;
    }

    const openDraft = event.target.closest("[data-ps-open-draft]");
    if (openDraft) {
      state.selectedDraftId = openDraft.dataset.psOpenDraft;
      const draft = getSelectedDraft();
      state.selectedVariantId = draft?.selectedVariantId || draft?.recommendedVariantId || draft?.variants?.[0]?.id || "";
      currentStep = "draft";
      save();
      render();
      return;
    }

    const openImportSchedule = event.target.closest("[data-ps-open-import-schedule]");
    if (openImportSchedule) {
      selectedImportBatchId = openImportSchedule.dataset.psOpenImportSchedule || "";
      currentStep = "import-detail";
      render();
      return;
    }

    const compareImports = event.target.closest("[data-ps-compare-imports]");
    if (compareImports) {
      const [sourceBatchId = "", targetBatchId = ""] = String(compareImports.dataset.psCompareImports || "").split("::");
      selectedCompareImportIds = { sourceBatchId, targetBatchId };
      currentStep = "version-compare";
      render();
      return;
    }

    const copyImportDraft = event.target.closest("[data-ps-copy-import-draft]");
    if (copyImportDraft) {
      createDraftFromImport(copyImportDraft.dataset.psCopyImportDraft);
      return;
    }

    const rollback = event.target.closest("[data-ps-rollback]");
    if (rollback) {
      rollbackImport(rollback.dataset.psRollback);
    }
  };

  const handleBodyInput = event => {
    const blockField = event.target.closest("[data-ps-block-field]");
    if (blockField) {
      updateDraftBlock(blockField);
      save();
      renderFeatureCard();
      return;
    }

    const goalField = event.target.closest("[data-ps-goal-field]");
    if (goalField) {
      updateGoalField(goalField);
      save();
      renderFeatureCard();
      return;
    }

    const field = event.target.closest("[data-ps-field]");
    if (field) {
      setPath(field.dataset.psField, coerceInputValue(field));
      applyPeriodDefaults();
      save();
      renderFeatureCard();
      return;
    }

    const checkbox = event.target.closest("[data-ps-checkbox]");
    if (checkbox) {
      setPath(checkbox.dataset.psCheckbox, checkbox.checked);
      save();
      renderFeatureCard();
      return;
    }

    const note = event.target.closest("[data-ps-big-five-note]");
    if (note) {
      const question = PERSONAL_SCHEDULE_BIG_FIVE_QUESTIONS[bigFiveIndex];
      if (!question) return;
      state.bigFive = {
        ...state.bigFive,
        answers: {
          ...state.bigFive.answers,
          [`${question.id}:note`]: note.value.slice(0, 500),
        },
      };
      save();
      return;
    }

    const importOption = event.target.closest("[data-ps-import-option]");
    if (importOption) {
      state.importOptions = {
        ...state.importOptions,
        [importOption.dataset.psImportOption]: importOption.checked,
      };
      save();
      render();
    }
  };

  const handleActionClick = event => {
    const action = event.target.closest("[data-ps-action]")?.dataset.psAction;
    if (!action) return;
    if (action === "next") goNext();
    if (action === "back") goBack();
    if (action === "next-big-five") goNextBigFive();
    if (action === "generate") generateDraft();
    if (action === "regenerate") generateDraft({ revision: true });
    if (action === "confirm-import") {
      const validation = getSelectedDraftValidation();
      if (!validation?.ok) {
        state.status = "validation_failed";
        state.lastError = {
          code: "validation_failed",
          message: getValidationSummary(validation),
          createdAt: now().toISOString(),
        };
        save();
        showStatus(state.lastError.message);
        render();
        return;
      }
      currentStep = "confirm-import";
      state.status = "ready_to_import";
      state.lastError = null;
      save();
      render();
    }
    if (action === "import") importDraft();
    if (action === "draft") {
      currentStep = "draft";
      render();
    }
    if (action === "history") {
      currentStep = "history";
      render();
    }
    if (action === "cleanup-imported-tasks") cleanupImportedTasks();
    if (action === "delete-profile") deleteProfile();
    if (action === "delete-history") deleteHistory();
  };

  const goNext = () => {
    if (currentStep === "rest") {
      currentStep = state.intake.mode === "deep" ? "big-five-intro" : "review";
    } else if (currentStep === "big-five-intro") {
      currentStep = state.bigFive.skipped ? "review" : "big-five-question";
      if (currentStep === "big-five-question") bigFiveIndex = getNextBigFiveIndex();
    } else {
      const index = INTAKE_STEPS.indexOf(currentStep);
      currentStep = INTAKE_STEPS[Math.min(index + 1, INTAKE_STEPS.length - 1)] || "review";
    }
    state.status = currentStep === "review" ? "intake_saved" : "intake_in_progress";
    state.normalizedProfile = normalizePersonalScheduleProfile(state.intake, state.bigFive.scores);
    save();
    render();
  };

  const goBack = () => {
    if (currentStep === "big-five-question" && bigFiveIndex > 0) {
      bigFiveIndex -= 1;
      render();
      return;
    }
    if (currentStep === "review" && state.intake.mode === "quick") {
      currentStep = "rest";
    } else if (currentStep === "review" && state.intake.mode === "deep") {
      currentStep = state.bigFive.skipped ? "big-five-intro" : "big-five-question";
    } else if (currentStep === "confirm-import") {
      currentStep = "draft";
    } else if (currentStep === "import-detail") {
      currentStep = "history";
    } else if (currentStep === "version-compare") {
      currentStep = "history";
    } else if (currentStep === "draft") {
      currentStep = "review";
    } else if (currentStep === "history") {
      currentStep = getSelectedDraft() ? "draft" : "mode";
    } else {
      const index = UI_STEPS.indexOf(currentStep);
      currentStep = UI_STEPS[Math.max(0, index - 1)] || "mode";
    }
    render();
  };

  const goNextBigFive = () => {
    const question = PERSONAL_SCHEDULE_BIG_FIVE_QUESTIONS[bigFiveIndex];
    if (!Number(state.bigFive.answers[question.id])) {
      showStatus("Выберите ответ, чтобы продолжить.");
      return;
    }
    if (bigFiveIndex + 1 >= PERSONAL_SCHEDULE_BIG_FIVE_QUESTIONS.length) {
      state.bigFive = {
        ...state.bigFive,
        skipped: false,
        scores: calculateBigFiveScores(state.bigFive.answers),
      };
      currentStep = "review";
    } else {
      bigFiveIndex += 1;
    }
    save();
    render();
  };

  const generateDraft = async ({ revision = false } = {}) => {
    const existingIntervals = getExistingIntervals();
    const request = createPersonalScheduleAiRequest({
      intake: state.intake,
      existingIntervals,
      bigFiveScores: state.bigFive.scores,
      now: now(),
    });
    state.status = "generation_pending";
    state.normalizedProfile = request.normalizedProfile;
    state.lastError = null;
    await save();
    render();
    showStatus("Собираю расписание. Если сервис не ответит, Focus подготовит локальный черновик.");

    const result = await sync?.generatePersonalSchedule?.(request);
    if (result?.status === "draft_ready" && result.draft) {
      await commitGeneratedDraft({
        draft: {
          ...result.draft,
          source: result.provider || "mock",
        },
        revision,
        provider: result.provider || "mock",
        promptVersion: result.promptVersion || PERSONAL_SCHEDULE_PROMPT_VERSION,
        statusMessage: "Черновик расписания готов. Проверьте и отредактируйте его перед импортом.",
      });
      return;
    }

    const fallbackReason = getGenerationFallbackReason(result);
    const fallbackDraft = createLocalFallbackDraft({ request, existingIntervals, fallbackReason });
    await commitGeneratedDraft({
      draft: fallbackDraft,
      revision,
      provider: "local_fallback",
      promptVersion: PERSONAL_SCHEDULE_PROMPT_VERSION,
      statusMessage: "Сервис генерации не ответил, поэтому Focus собрал локальный черновик на устройстве. Проверьте его перед импортом.",
    });
  };

  const commitGeneratedDraft = async ({ draft, revision = false, provider = "mock", promptVersion = PERSONAL_SCHEDULE_PROMPT_VERSION, statusMessage = "" } = {}) => {
    state.drafts = [draft, ...state.drafts.filter(item => item.id !== draft.id)].slice(0, 10);
    state.selectedDraftId = draft.id;
    state.selectedVariantId = draft.selectedVariantId || draft.recommendedVariantId || draft.variants?.[0]?.id || "";
    state.status = "draft_ready";
    state.lastError = null;
    state.history = [{
      id: `history-${Date.now()}`,
      type: revision ? "revision" : "generation",
      promptVersion,
      provider,
      createdAt: now().toISOString(),
    }, ...state.history].slice(0, 20);
    currentStep = "draft";
    await save();
    if (statusMessage) showStatus(statusMessage);
    render();
  };

  const createLocalFallbackDraft = ({ request, existingIntervals, fallbackReason }) => ({
    ...createDeterministicScheduleDraft({
      intake: state.intake,
      bigFiveScores: state.bigFive.scores,
      existingIntervals,
      variantCount: request?.mode === "deep" ? 3 : 1,
      now: now(),
    }),
    source: "local_fallback",
    fallbackReason,
  });

  const getGenerationFallbackReason = result => {
    if (result?.status === "offline") return "offline";
    if (result?.status === "provider-not-configured") return "service_unavailable";
    if (result?.status === "invalid-request") return "request_validation_failed";
    if (result?.status) return result.status;
    return "service_unavailable";
  };

  const createDraftFromImport = async batchId => {
    const batch = state.importBatches.find(item => item.id === batchId) || getSelectedImportBatch();
    const schedule = getImportBatchPrimarySchedule(batch);
    const dayTimes = getImportScheduleDayTimes(schedule);
    if (!batch || !schedule || !dayTimes.length) {
      showStatus("Сохраненный ритм не найден.");
      render();
      return;
    }
    const draft = createDraftFromImportedSchedule(batch, schedule, dayTimes);
    if (!draft) {
      showStatus("Не удалось собрать черновик из сохраненного ритма.");
      render();
      return;
    }
    selectedImportBatchId = batch.id || selectedImportBatchId;
    await commitGeneratedDraft({
      draft,
      revision: true,
      provider: "import_copy",
      promptVersion: draft.promptVersion || PERSONAL_SCHEDULE_PROMPT_VERSION,
      statusMessage: "Копия ритма открыта как черновик. Проверьте блоки перед импортом.",
    });
  };

  const importDraft = async () => {
    const draft = getSelectedDraft();
    const variant = getSelectedVariant(draft);
    if (!draft || !variant) return;

    state.status = "importing";
    await save();
    render();

    const batchResult = createPersonalScheduleImportBatch({
      draft,
      selectedVariantId: variant.id,
      includeTasks: state.importOptions.includeTasks,
      includeReminders: state.importOptions.includeReminders,
      existingIntervals: getExistingIntervalsForDraft(draft),
      now: now(),
    });
    if (!batchResult.ok) {
      state.status = "validation_failed";
      state.lastError = {
        code: "validation_failed",
        message: getValidationErrorsSummary(batchResult.errors),
        createdAt: now().toISOString(),
      };
      await save();
      render();
      return;
    }

    const data = getExistingData();
    const replacement = getReplacementImportRollback(draft, data, batchResult.batch?.id || "");
    const baseCollections = replacement?.collections || data;
    const applied = applyPersonalScheduleImportBatch({
      batch: replacement ? {
        ...batchResult.batch,
        replacesImportBatchId: replacement.batch.id,
        replacementSource: "import_copy",
      } : batchResult.batch,
      schedules: baseCollections.schedules,
      tasks: baseCollections.tasks,
      reminders: baseCollections.reminders,
      now: now(),
    });
    state.status = applied.status;
    state.importBatches = [
      applied.batch,
      ...state.importBatches
        .map(batch => replacement?.batch && batch.id === replacement.batch.id ? replacement.batch : batch)
        .filter(batch => batch.id !== applied.batch.id),
    ].slice(0, 20);
    setCollections({
      schedules: applied.schedules,
      tasks: applied.tasks,
      reminders: applied.reminders,
      reason: replacement ? "personal_schedule_import_replace" : "personal_schedule_import",
    });
    await save();
    showStatus(replacement
      ? "Обновленная версия ритма импортирована в Focus. Старая версия откатана."
      : "Расписание импортировано в Focus. Его можно откатить из истории ритма дня.");
    currentStep = "history";
    render();
  };

  const rollbackImport = async batchId => {
    const batch = state.importBatches.find(item => item.id === batchId && item.status === "applied");
    if (!batch) return;
    const data = getExistingData();
    const rolledBack = rollbackPersonalScheduleImportBatch({
      batch,
      schedules: data.schedules,
      tasks: data.tasks,
      reminders: data.reminders,
      now: now(),
    });
    state.status = "rolled_back";
    state.importBatches = state.importBatches.map(item => item.id === batch.id ? rolledBack.batch : item);
    setCollections({
      schedules: rolledBack.schedules,
      tasks: rolledBack.tasks,
      reminders: rolledBack.reminders,
      reason: "personal_schedule_rollback",
    });
    await save();
    showStatus("Импорт персонального расписания откатан.");
    render();
  };

  const cleanupImportedTasks = async () => {
    const data = getExistingData();
    const cleaned = cleanupPersonalScheduleImportedTasks({
      tasks: data.tasks,
      importBatches: state.importBatches,
      now: now(),
    });
    if (!cleaned.removedCount) {
      showStatus("Задачи, созданные Персональным ритмом, не найдены.");
      render();
      return;
    }
    state.importBatches = cleaned.importBatches;
    setCollections({
      tasks: cleaned.tasks,
      reason: "personal_schedule_task_cleanup",
    });
    await save();
    showStatus(`Убрано задач из Персонального ритма: ${cleaned.removedCount}.`);
    render();
  };

  const deleteProfile = async () => {
    state = withRuntimeDefaults({
      ...state,
      intake: createDefaultPersonalScheduleState(now()).intake,
      normalizedProfile: null,
      bigFive: { skipped: true, answers: {}, scores: calculateBigFiveScores(null) },
      status: state.drafts.length ? "draft_ready" : "idle",
    });
    await save();
    showStatus("Профиль планировщика очищен.");
    render();
  };

  const deleteHistory = async () => {
    state = withRuntimeDefaults({
      ...state,
      drafts: [],
      selectedDraftId: "",
      selectedVariantId: "",
      history: [],
      importBatches: [],
      adaptationSuggestions: [],
      status: "idle",
    });
    await save();
    showStatus("История ритма дня очищена.");
    currentStep = "mode";
    render();
  };

  const refreshProviderStatus = async ({ silent = false } = {}) => {
    const result = await sync?.getPersonalScheduleStatus?.();
    lastStatus = result || lastStatus;
    if (!silent && result?.status === "offline") {
      showStatus("Сервис генерации расписания сейчас недоступен.");
    }
    render();
    return lastStatus;
  };

  const getExistingIntervals = ({ excludeScheduleIds = [] } = {}) => {
    const data = getExistingData();
    const excludedSchedules = new Set(excludeScheduleIds.map(String));
    return collectPersonalScheduleExistingIntervals({
      schedules: (Array.isArray(data.schedules) ? data.schedules : [])
        .filter(schedule => !excludedSchedules.has(String(schedule?.id || ""))),
      reminders: data.reminders,
      tasks: data.tasks,
      birthdays: data.birthdays,
      includeCalendar: state.intake.includeCalendar,
      now: now(),
    });
  };

  const getSelectedDraft = () => state.drafts.find(item => item.id === state.selectedDraftId) || state.drafts[0] || null;
  const getSelectedVariant = draft => draft?.variants?.find(item => item.id === state.selectedVariantId)
    || draft?.variants?.find(item => item.id === draft.recommendedVariantId)
    || draft?.variants?.[0]
    || null;
  const getLastAppliedBatch = () => state.importBatches.find(batch => batch.status === "applied");
  const getSelectedImportBatch = () => state.importBatches.find(batch => batch.id === selectedImportBatchId)
    || getLastAppliedBatch()
    || state.importBatches.find(batch => batch.status === "rolled_back")
    || null;
  const getImportedTaskCleanupCount = () => cleanupPersonalScheduleImportedTasks({
    tasks: getExistingData().tasks,
    importBatches: state.importBatches,
    now: now(),
  }).removedCount;
  const getExistingIntervalsForDraft = draft => getExistingIntervals({
    excludeScheduleIds: getDraftReplacementScheduleIds(draft),
  });
  const getDraftReplacementBatchId = draft => draft?.source === "import_copy"
    ? String(draft.replacesImportBatchId || draft.sourceImportBatchId || "")
    : "";
  const getDraftReplacementImportBatch = draft => {
    const batchId = getDraftReplacementBatchId(draft);
    if (!batchId) return null;
    return state.importBatches.find(batch => batch.id === batchId && batch.status === "applied") || null;
  };
  const getDraftReplacementScheduleIds = draft => {
    const batch = getDraftReplacementImportBatch(draft);
    if (!batch) return [];
    const fromIds = Array.isArray(batch.importedIds?.schedules) ? batch.importedIds.schedules : [];
    const fromEntities = Array.isArray(batch.entities?.schedules) ? batch.entities.schedules.map(schedule => schedule?.id) : [];
    return [...new Set([...fromIds, ...fromEntities].map(String).filter(Boolean))];
  };
  const getReplacementImportRollback = (draft, data, replacedByImportBatchId = "") => {
    const batch = getDraftReplacementImportBatch(draft);
    if (!batch) return null;
    const rolledBack = rollbackPersonalScheduleImportBatch({
      batch,
      schedules: data.schedules,
      tasks: data.tasks,
      reminders: data.reminders,
      now: now(),
    });
    return {
      batch: {
        ...rolledBack.batch,
        rolledBackReason: "replaced",
        replacedByImportBatchId,
        replacedAt: rolledBack.batch.rolledBackAt,
      },
      collections: {
        schedules: rolledBack.schedules,
        tasks: rolledBack.tasks,
        reminders: rolledBack.reminders,
      },
    };
  };

  const getDefaultStepForState = () => {
    if (state.status === "draft_ready" || state.status === "ready_to_import" || state.status === "validation_failed") return "draft";
    if (state.status === "import_completed" || state.status === "rolled_back") return "history";
    if (state.status === "intake_saved" || state.status === "generation_failed") return "review";
    return "mode";
  };

  const getNextBigFiveIndex = () => {
    const index = PERSONAL_SCHEDULE_BIG_FIVE_QUESTIONS.findIndex(question => !Number(state.bigFive.answers[question.id]));
    return index >= 0 ? index : 0;
  };

  const startFreshIntake = () => {
    const fresh = createDefaultPersonalScheduleState(now());
    state = withRuntimeDefaults({
      ...state,
      status: "intake_in_progress",
      intake: fresh.intake,
      normalizedProfile: null,
      bigFive: fresh.bigFive,
      selectedDraftId: "",
      selectedVariantId: "",
      lastError: null,
    });
    currentStep = "mode";
  };

  const setPath = (path, value) => {
    const parts = path.split(".");
    const nextIntake = structuredCloneSafe(state.intake);
    let cursor = nextIntake;
    for (let index = 0; index < parts.length - 1; index += 1) {
      cursor[parts[index]] ||= {};
      cursor = cursor[parts[index]];
    }
    cursor[parts[parts.length - 1]] = value;
    state.intake = normalizePersonalScheduleIntake(nextIntake, now());
  };

  const toggleWeekday = (path, weekday) => {
    const source = getPath(state.intake, path);
    const values = new Set(Array.isArray(source) ? source : []);
    if (values.has(weekday)) values.delete(weekday);
    else values.add(weekday);
    setPath(path, [...values].sort((first, second) => first - second));
  };

  const applyGoalAction = (action, goalIndex) => {
    const goals = Array.isArray(state.intake.goals) ? structuredCloneSafe(state.intake.goals) : [];
    if (action === "add") {
      setPath("goals", [...goals, createGoalDraft(goals.length)].slice(0, 24));
      return;
    }
    if (action === "remove" && goals.length > 1 && Number.isInteger(goalIndex)) {
      setPath("goals", goals.filter((_, index) => index !== goalIndex));
    }
  };

  const updateGoalField = field => {
    const goalIndex = Number(field.dataset.psGoalIndex);
    const goalField = field.dataset.psGoalField;
    const goals = Array.isArray(state.intake.goals) ? state.intake.goals : [];
    if (!Number.isInteger(goalIndex) || goalIndex < 0 || goalIndex >= goals.length) return;
    const nextGoals = goals.map((goal, index) => {
      if (index !== goalIndex) return goal;
      const next = { ...goal };
      if (goalField === "title") next.title = String(field.value || "").slice(0, 120);
      if (goalField === "category") next.category = getAllowedOptionValue(field.value, GOAL_CATEGORY_OPTIONS, goal.category || "goal");
      if (goalField === "priority") next.priority = getAllowedOptionValue(field.value, GOAL_PRIORITY_OPTIONS, goal.priority || "medium");
      if (goalField === "preferredTime") next.preferredTime = getAllowedOptionValue(field.value, GOAL_TIME_OPTIONS, goal.preferredTime || "depends");
      if (goalField === "timesPerWeek") next.timesPerWeek = clampNumber(field.value, 1, 14);
      if (goalField === "desiredMinutes") {
        const desiredMinutes = clampNumber(field.value, 10, 360);
        next.desiredMinutes = desiredMinutes;
        next.minimumMinutes = Math.min(desiredMinutes, clampNumber(goal.minimumMinutes || desiredMinutes, 10, 240));
      }
      setGoalDefaults(next);
      return next;
    });
    setPath("goals", nextGoals);
  };

  const applyPeriodDefaults = () => {
    const period = state.intake.period;
    if (period.type === "typical_day") setPath("period.endDate", period.startDate);
    if (period.type === "work_week") setPath("period.endDate", addDaysIso(period.startDate, 4));
    if (period.type === "full_week") setPath("period.endDate", addDaysIso(period.startDate, 6));
  };

  const updateDraftBlock = field => {
    const draft = getSelectedDraft();
    const variant = getSelectedVariant(draft);
    if (!draft || !variant) return;
    const blockId = field.dataset.psBlockId;
    const blockField = field.dataset.psBlockField;
    variant.blocks = variant.blocks.map(block => {
      if (block.id !== blockId) return block;
      const next = { ...block, [blockField]: field.value };
      if (blockField === "startTime") next.startMinute = parseTimeToMinutes(field.value);
      if (blockField === "endTime") next.endMinute = parseTimeToMinutes(field.value);
      if (blockField === "title") next.title = field.value.slice(0, 120);
      next.durationMinutes = Math.max(0, Number(next.endMinute) - Number(next.startMinute));
      return next;
    });
    validateEditedVariant(draft, variant);
    draft.updatedAt = now().toISOString();
    state.status = "editing";
  };

  const applyDraftBlockAction = (blockId, action) => {
    const draft = getSelectedDraft();
    const variant = getSelectedVariant(draft);
    const blocks = Array.isArray(variant?.blocks) ? variant.blocks : [];
    if (!draft || !variant || !blockId || !action) return;
    if (action === "remove") {
      if (blocks.length <= 1) return;
      const nextBlocks = blocks.filter(block => block.id !== blockId);
      if (nextBlocks.length === blocks.length) return;
      variant.blocks = sortDraftBlocks(nextBlocks);
    } else {
      let changed = false;
      variant.blocks = sortDraftBlocks(blocks.map(block => {
        if (block.id !== blockId) return block;
        changed = true;
        if (action === "earlier") return shiftDraftBlock(block, -QUICK_EDIT_MINUTES);
        if (action === "later") return shiftDraftBlock(block, QUICK_EDIT_MINUTES);
        if (action === "shorter") return resizeDraftBlock(block, -QUICK_EDIT_MINUTES);
        if (action === "longer") return resizeDraftBlock(block, QUICK_EDIT_MINUTES);
        if (action === "toggle-fixed") {
          return {
            ...block,
            flexibility: block.flexibility === "fixed" ? "semi_flexible" : "fixed",
          };
        }
        return block;
      }));
      if (!changed) return;
    }
    validateEditedVariant(draft, variant);
    draft.selectedVariantId = variant.id;
    draft.updatedAt = now().toISOString();
    state.selectedVariantId = variant.id;
    state.status = "editing";
    state.lastError = null;
  };

  const validateEditedVariant = (draft, variant) => {
    variant.validation = validatePersonalScheduleDraft({
      draft: { blocks: variant.blocks },
      intake: draft.intake,
      existingIntervals: getExistingIntervalsForDraft(draft),
    });
    return variant.validation;
  };

  return {
    bind,
    hydrate: load,
    open,
    renderFeatureCard,
    setOpenModal,
  };

  function renderChoiceCard(value, title, description, active, attr) {
    return `
      <button class="choice-card ${active ? "choice-card--active" : ""}" type="button" ${attr}="${escape(value)}" aria-pressed="${String(active)}">
        <span>${escape(title)}</span>
        <small>${escape(description)}</small>
      </button>
    `;
  }

  function renderInput(label, path, value, type = "text", disabled = false) {
    return `
      <label class="field-block">
        <span>${escape(label)}</span>
        <input data-ps-field="${escape(path)}" type="${escape(type)}" value="${escape(value ?? "")}" ${disabled ? "disabled" : ""} />
      </label>
    `;
  }

  function renderSelect(label, path, value, options) {
    return `
      <label class="field-block">
        <span>${escape(label)}</span>
        <select data-ps-field="${escape(path)}">
          ${options.map(([optionValue, optionLabel]) => `<option value="${escape(optionValue)}" ${optionValue === value ? "selected" : ""}>${escape(optionLabel)}</option>`).join("")}
        </select>
      </label>
    `;
  }

  function renderEnergyRule(title, text) {
    return `
      <article>
        <strong>${escape(title)}</strong>
        <span>${escape(text)}</span>
      </article>
    `;
  }

  function renderEnergyInput(label, path, value, hint) {
    return `
      <label class="field-block field-block--with-hint">
        <span>${escape(label)}</span>
        <input data-ps-field="${escape(path)}" type="number" value="${escape(value ?? "")}" step="1" inputmode="numeric" />
        <small class="field-block__hint">${escape(hint)}</small>
      </label>
    `;
  }

  function renderEnergySelect(label, path, value, options, hint) {
    return `
      <label class="field-block field-block--with-hint">
        <span>${escape(label)}</span>
        <select data-ps-field="${escape(path)}">
          ${options.map(([optionValue, optionLabel]) => `<option value="${escape(optionValue)}" ${optionValue === value ? "selected" : ""}>${escape(optionLabel)}</option>`).join("")}
        </select>
        <small class="field-block__hint">${escape(hint)}</small>
      </label>
    `;
  }

  function renderGoalEditor(goal, index, goalCount) {
    return `
      <article class="personal-schedule-goal-card">
        <header class="personal-schedule-goal-card__head">
          <div>
            <strong>${escape(goal.title || `Цель ${index + 1}`)}</strong>
            <span>${escape(getGoalSummary(goal))}</span>
          </div>
          <button class="icon-button icon-button--tiny" type="button" data-ps-goal-action="remove" data-ps-goal-index="${index}" aria-label="Удалить цель" title="Удалить цель" ${goalCount <= 1 ? "disabled" : ""}>
            <span class="icon icon-trash" aria-hidden="true"></span>
          </button>
        </header>
        <div class="personal-schedule-goal-grid">
          ${renderGoalInput("Название цели", index, "title", goal.title || "", "text")}
          ${renderGoalSelect("Направление", index, "category", goal.category || "goal", GOAL_CATEGORY_OPTIONS)}
          ${renderGoalSelect("Важность", index, "priority", goal.priority || "medium", GOAL_PRIORITY_OPTIONS)}
          ${renderGoalInput("Раз в неделю", index, "timesPerWeek", goal.timesPerWeek || 1, "number", "1", "14")}
          ${renderGoalInput("Минут за раз", index, "desiredMinutes", goal.desiredMinutes || 45, "number", "10", "360")}
          ${renderGoalSelect("Лучшее время", index, "preferredTime", goal.preferredTime || "depends", GOAL_TIME_OPTIONS)}
        </div>
      </article>
    `;
  }

  function renderGoalInput(label, index, field, value, type = "text", min = "", max = "") {
    return `
      <label class="field-block">
        <span>${escape(label)}</span>
        <input data-ps-goal-index="${index}" data-ps-goal-field="${escape(field)}" type="${escape(type)}" value="${escape(value ?? "")}" ${min ? `min="${escape(min)}"` : ""} ${max ? `max="${escape(max)}"` : ""} ${type === "number" ? 'step="1" inputmode="numeric"' : ""} />
      </label>
    `;
  }

  function renderGoalSelect(label, index, field, value, options) {
    return `
      <label class="field-block">
        <span>${escape(label)}</span>
        <select data-ps-goal-index="${index}" data-ps-goal-field="${escape(field)}">
          ${options.map(([optionValue, optionLabel]) => `<option value="${escape(optionValue)}" ${optionValue === value ? "selected" : ""}>${escape(optionLabel)}</option>`).join("")}
        </select>
      </label>
    `;
  }

  function renderCheckbox(label, path, checked) {
    return `
      <label>
        <input data-ps-checkbox="${escape(path)}" type="checkbox" ${checked ? "checked" : ""} />
        <span>${escape(label)}</span>
      </label>
    `;
  }

  function renderImportCheckbox(label, key, checked) {
    return `
      <label>
        <input data-ps-import-option="${escape(key)}" type="checkbox" ${checked ? "checked" : ""} />
        <span>${escape(label)}</span>
      </label>
    `;
  }

  function renderWeekdayPicker(path, values) {
    const selected = new Set(values);
    return `
      <div class="personal-schedule-weekdays" aria-label="Дни недели">
        ${[1, 2, 3, 4, 5, 6, 7].map(weekday => `
          <button class="${selected.has(weekday) ? "is-selected" : ""}" type="button" data-ps-weekday-path="${escape(path)}" data-ps-weekday="${weekday}" aria-pressed="${String(selected.has(weekday))}">
            ${escape(getWeekdayShortLabel(weekday))}
          </button>
        `).join("")}
      </div>
    `;
  }

  function renderDraftOverview(draft, variant, validation, blocks) {
    const stats = getDraftOverviewStats(blocks);
    return `
      <section class="personal-schedule-draft-overview" aria-label="Обзор черновика">
        ${renderDraftResultBrief(draft, variant, validation, stats, blocks)}
        ${renderDraftRhythmSummary(draft?.intake, stats)}
        ${renderDraftWhyPanel(draft, variant, stats, blocks)}
        ${renderDraftDecisionWarnings(draft?.intake, validation, stats, blocks)}
        ${renderDraftImportPreview(blocks)}
        <div class="personal-schedule-draft-metrics">
          ${renderDraftMetric("План", formatMinutesDuration(stats.totalMinutes), `${stats.blockCount} бл.`)}
          ${renderDraftMetric("Цели", String(stats.goalBlockCount), formatMinutesDuration(stats.goalMinutes))}
          ${renderDraftMetric("Отдых", formatMinutesDuration(stats.restMinutes), `${stats.restBlockCount} бл.`)}
          ${renderDraftMetric("Зафиксировано", String(stats.fixedBlockCount), validation?.ok ? "без конфликтов" : "проверьте")}
        </div>
        ${renderDraftDayPreview(blocks)}
      </section>
    `;
  }

  function renderDraftWhyPanel(draft, variant, stats, blocks) {
    const items = getDraftWhyItems(draft, variant, stats, blocks);
    return `
      <section class="personal-schedule-why-panel" aria-label="Почему так составлено">
        <span class="modal-kicker">Почему так составлено</span>
        <div class="personal-schedule-why-list">
          ${items.map(item => `
            <article>
              <strong>${escape(item.title)}</strong>
              <span>${escape(item.body)}</span>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderDraftMetric(label, value, hint) {
    return `
      <div class="personal-schedule-draft-metric">
        <span>${escape(label)}</span>
        <strong>${escape(value)}</strong>
        <small>${escape(hint)}</small>
      </div>
    `;
  }

  function renderDraftResultBrief(draft, variant, validation, stats, blocks) {
    const title = variant?.title || "Вариант ритма";
    const reason = variant?.recommendationReason || variant?.summary || getDraftResultSummary(stats, blocks);
    return `
      <div class="personal-schedule-result-brief">
        <div>
          <span class="modal-kicker">Итог опроса</span>
          <h3>${escape(title)}</h3>
          <p>${escape(reason)}</p>
        </div>
        <span class="schedule-status-pill ${validation?.ok ? "is-active" : ""}">${validation?.ok ? "Готов к импорту" : "Нужны правки"}</span>
      </div>
    `;
  }

  function renderDraftRhythmSummary(intake, stats) {
    return `
      <div class="personal-schedule-rhythm-summary" aria-label="Краткий ритм дня">
        ${renderRhythmSummaryItem("Сон", getSleepWindowLabel(intake?.sleep), `${formatMinutesDuration(Number(intake?.sleep?.minimumSleepMinutes) || 0)} минимум`)}
        ${renderRhythmSummaryItem("Работа", formatMinutesDuration(stats.workMinutes), `${stats.workBlockCount} бл.`)}
        ${renderRhythmSummaryItem("Фокус", formatMinutesDuration(stats.focusMinutes), `${stats.focusBlockCount} бл.`)}
        ${renderRhythmSummaryItem("Отдых", formatMinutesDuration(stats.restMinutes), `${stats.restBlockCount} бл.`)}
      </div>
    `;
  }

  function renderRhythmSummaryItem(label, value, hint) {
    return `
      <div class="personal-schedule-rhythm-summary__item">
        <span>${escape(label)}</span>
        <strong>${escape(value)}</strong>
        <small>${escape(hint)}</small>
      </div>
    `;
  }

  function renderDraftDecisionWarnings(intake, validation, stats, blocks) {
    const items = getDraftDecisionWarningItems(intake, validation, stats, blocks, getValidationSummary(validation));
    const hasWarning = items.some(item => item.level !== "ok");
    return `
      <section class="personal-schedule-decision-panel ${hasWarning ? "has-warning" : ""}" aria-label="Проверка ритма">
        <span class="modal-kicker">Проверка</span>
        <div class="personal-schedule-warning-list">
          ${items.map(item => `
            <article class="personal-schedule-warning personal-schedule-warning--${escape(item.level)}">
              <strong>${escape(item.title)}</strong>
              <span>${escape(item.body)}</span>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderDraftImportPreview(blocks) {
    const count = Array.isArray(blocks) ? blocks.length : 0;
    const entities = {
      schedules: count ? [{}] : [],
      tasks: state.importOptions.includeTasks ? new Array(count).fill({}) : [],
      reminders: state.importOptions.includeReminders ? new Array(count).fill({}) : [],
    };
    return `
      <section class="personal-schedule-import-preview" aria-label="Что будет добавлено в Focus">
        <span class="modal-kicker">Импорт</span>
        ${renderImportImpactList(entities)}
      </section>
    `;
  }

  function renderImportImpactList(entities) {
    return `
      <div class="personal-schedule-import-impact">
        ${renderImportImpactItem("Расписание", entities.schedules?.length || 0, "Одна недельная сетка с блоками по дням.")}
        ${renderImportImpactItem("Задачи", entities.tasks?.length || 0, (entities.tasks?.length || 0) ? "Каждый блок появится отдельной задачей с датой и временем." : "Не создаются, чтобы не перегружать список дел.")}
        ${renderImportImpactItem("Напоминания", entities.reminders?.length || 0, (entities.reminders?.length || 0) ? "Напоминания будут привязаны к времени блоков." : "Не создаются без отдельного включения.")}
      </div>
    `;
  }

  function renderImportReplacementNotice(draft) {
    if (!getDraftReplacementImportBatch(draft)) return "";
    return `
      <div class="voice-status voice-status--warn">
        Это копия сохраненного ритма. При импорте старая версия будет откатана, а новая станет текущей.
      </div>
    `;
  }

  function renderImportConfirmationPlan({ draft, variant, blocks, entities }) {
    const stats = getDraftOverviewStats(blocks);
    const scheduleCount = entities.schedules?.length || 0;
    const taskCount = entities.tasks?.length || 0;
    const reminderCount = entities.reminders?.length || 0;
    const variantTitle = variant?.title || "Выбранный вариант";
    const sourceLabel = draft?.source === "local_fallback" ? "локальный черновик" : "черновик";
    return `
      <section class="personal-schedule-import-confirmation" aria-label="План импорта">
        <header class="personal-schedule-import-confirmation__head">
          <div>
            <span class="modal-kicker">Перед добавлением</span>
            <h4>${escape(variantTitle)}</h4>
            <p>Focus добавит ${escape(sourceLabel)} как расписание. Блоки останутся внутри расписания; отдельные задачи и напоминания появятся только если включить их ниже.</p>
          </div>
          <div class="personal-schedule-import-confirmation__summary" aria-label="Сводка черновика">
            <span><strong>${escape(String(stats.blockCount))}</strong><small>блоков</small></span>
            <span><strong>${escape(String(stats.dayCount))}</strong><small>дней</small></span>
            <span><strong>${escape(formatMinutesDuration(stats.totalMinutes))}</strong><small>в плане</small></span>
          </div>
        </header>
        <div class="personal-schedule-import-confirmation__grid">
          ${renderImportDecisionItem({
            key: "schedule",
            status: scheduleCount ? "Создаётся сейчас" : "Не будет создано",
            title: "Расписание в Focus",
            count: `${scheduleCount} объект`,
            hint: scheduleCount ? "В нём будут все блоки выбранного ритма по дням." : "Вернитесь к черновику и проверьте блоки.",
            active: Boolean(scheduleCount),
          })}
          ${renderImportDecisionItem({
            key: "tasks",
            status: taskCount ? "Создаются дополнительно" : "Остаются выключены",
            title: "Задачи из блоков",
            count: `${taskCount} карточек`,
            hint: taskCount ? "Каждая задача получит дату, время и пометку «Персональный ритм»." : "Список дел не заполнится копиями блоков.",
            active: Boolean(taskCount),
          })}
          ${renderImportDecisionItem({
            key: "reminders",
            status: reminderCount ? "Создаются дополнительно" : "Остаются выключены",
            title: "Напоминания",
            count: `${reminderCount} шт.`,
            hint: reminderCount ? "Напоминания привяжутся ко времени сложных блоков." : "Уведомления не появятся без отдельного включения.",
            active: Boolean(reminderCount),
          })}
        </div>
        ${renderImportBlockExamples(blocks)}
        <p class="personal-schedule-import-confirmation__note">После импорта эту пачку можно откатить из истории «Персонального ритма дня».</p>
      </section>
    `;
  }

  function renderImportDecisionItem({ key, status, title, count, hint, active }) {
    return `
      <article class="personal-schedule-import-confirmation__decision ${active ? "is-active" : "is-muted"}" data-ps-import-decision="${escape(key)}">
        <span>${escape(status)}</span>
        <strong>${escape(title)}</strong>
        <small>${escape(count)} · ${escape(hint)}</small>
      </article>
    `;
  }

  function renderImportBlockExamples(blocks) {
    const sorted = sortDraftBlocks(blocks);
    const visible = sorted.slice(0, 5);
    if (!visible.length) return "";
    const remaining = Math.max(0, sorted.length - visible.length);
    return `
      <div class="personal-schedule-import-block-list" aria-label="Примеры блоков внутри расписания">
        <div class="personal-schedule-import-block-list__head">
          <span class="modal-kicker">Внутри расписания</span>
          ${remaining ? `<small>ещё ${escape(String(remaining))} бл.</small>` : ""}
        </div>
        <div class="personal-schedule-import-block-list__items">
          ${visible.map(renderImportBlockExample).join("")}
        </div>
      </div>
    `;
  }

  function renderImportBlockExample(block) {
    return `
      <article class="personal-schedule-import-block" data-ps-category="${escape(block.category || "event")}">
        <time>${escape(block.startTime || "")}-${escape(block.endTime || "")}</time>
        <div>
          <strong>${escape(block.title || "Блок расписания")}</strong>
          <small>${escape(getPersonalScheduleWeekdayLabel(block.weekday))} · ${escape(getCategoryLabel(block.category))} · ${escape(formatMinutesDuration(getDraftBlockDuration(block)))}</small>
        </div>
      </article>
    `;
  }

  function renderLatestImportResult(batch) {
    const rolledBack = batch?.status === "rolled_back";
    const counts = getImportBatchEntityCounts(batch);
    return `
      <section class="personal-schedule-import-result ${rolledBack ? "is-rolled-back" : "is-applied"}" aria-label="Последний импорт">
        <header class="personal-schedule-import-result__head">
          <div>
            <span class="modal-kicker">Последний импорт</span>
            <h4>${escape(getImportResultTitle(batch))}</h4>
            <p>${escape(getImportResultDescription(batch))}</p>
          </div>
          <div class="personal-schedule-import-result__actions">
            ${renderOpenImportScheduleButton(batch, "Открыть полный ритм")}
            ${renderCompareImportVersionsButton(batch, "Сравнить версии")}
            ${batch?.status === "applied" ? `<button class="secondary-button secondary-button--compact" type="button" data-ps-rollback="${escape(batch.id)}">Откатить импорт</button>` : ""}
          </div>
        </header>
        ${renderImportImpactList(batch?.entities || {})}
        ${renderImportScheduleSnapshot(batch)}
        <div class="personal-schedule-import-result__destinations-head">
          <strong>Где искать добавленное</strong>
          <small>Focus разложил импорт по разделам приложения.</small>
        </div>
        <div class="personal-schedule-import-result__destinations" aria-label="Где искать добавленное">
          ${renderImportResultDestination("Расписание", counts.schedules, "Раздел расписаний Focus", "Основная сетка ритма по дням.")}
          ${renderImportResultDestination("Задачи", counts.tasks, counts.tasks ? "Дела на даты блоков" : "Не создавались", counts.tasks ? "Появились только включенные блоки." : "Список дел не был заполнен копиями блоков.")}
          ${renderImportResultDestination("Напоминания", counts.reminders, counts.reminders ? "Центр напоминаний" : "Не создавались", counts.reminders ? "Привязаны ко времени сложных блоков." : "Уведомления не добавлялись без галочки.")}
        </div>
      </section>
    `;
  }

  function renderImportResultDestination(title, count, place, hint) {
    return `
      <article class="personal-schedule-import-result__destination ${count ? "is-active" : "is-muted"}">
        <span>${escape(title)}</span>
        <strong>${escape(place)}</strong>
        <small>${escape(String(count))} · ${escape(hint)}</small>
      </article>
    `;
  }

  function renderImportHistoryRow(batch) {
    const counts = getImportBatchEntityCounts(batch);
    const dateText = formatDateTime(batch?.appliedAt || batch?.rolledBackAt || batch?.createdAt);
    const replacementBatch = getReplacementTargetBatch(batch);
    return `
      <article class="personal-schedule-history-import" data-ps-import-status="${escape(getImportDisplayStatus(batch))}">
        <div>
          <strong>${escape(getImportHistoryTitle(batch))}</strong>
          <span>${escape(dateText)} · расписаний: ${escape(String(counts.schedules))}, задач: ${escape(String(counts.tasks))}, напоминаний: ${escape(String(counts.reminders))}</span>
          ${renderImportHistoryVersionSummary(batch)}
          ${renderImportHistoryScheduleSummary(batch)}
        </div>
        <div class="personal-schedule-history-import__actions">
          ${renderOpenImportScheduleButton(batch, isReplacementRollback(batch) ? "Открыть старую версию" : "Открыть ритм")}
          ${replacementBatch ? renderOpenImportScheduleButton(replacementBatch, "Открыть новую версию") : ""}
          ${renderCompareImportVersionsButton(batch, "Сравнить версии")}
          ${batch?.status === "applied" ? `<button class="secondary-button secondary-button--compact" type="button" data-ps-rollback="${escape(batch.id)}">Откатить</button>` : ""}
        </div>
      </article>
    `;
  }

  function renderOpenImportScheduleButton(batch, label) {
    if (!batch?.id || !getImportScheduleDayTimes(getImportBatchPrimarySchedule(batch)).length) return "";
    return `
      <button class="secondary-button secondary-button--compact" type="button" data-ps-open-import-schedule="${escape(batch.id)}">
        <span class="icon icon-calendar" aria-hidden="true"></span>${escape(label)}
      </button>
    `;
  }

  function renderCompareImportVersionsButton(batch, label = "Сравнить версии") {
    const pair = getImportVersionComparePair(batch);
    if (!pair || !canCompareImportSchedules(pair.sourceBatch, pair.targetBatch)) return "";
    const pairId = `${pair.sourceBatch.id}::${pair.targetBatch.id}`;
    return `
      <button class="secondary-button secondary-button--compact" type="button" data-ps-compare-imports="${escape(pairId)}">
        <span class="icon icon-checklist" aria-hidden="true"></span>${escape(label)}
      </button>
    `;
  }

  function renderImportScheduleSnapshot(batch) {
    const schedule = getImportBatchPrimarySchedule(batch);
    const dayTimes = getImportScheduleDayTimes(schedule);
    if (!schedule || !dayTimes.length) return "";
    const blockCount = getImportScheduleBlockCount(dayTimes);
    const visibleDays = dayTimes.slice(0, 3);
    const hiddenDayCount = Math.max(0, dayTimes.length - visibleDays.length);
    return `
      <section class="personal-schedule-import-snapshot" aria-label="Что внутри расписания">
        <header class="personal-schedule-import-snapshot__head">
          <div>
            <strong>Что внутри расписания</strong>
            <small>${escape(schedule.title || "Персональный ритм дня")} · ${escape(formatImportScheduleScope(dayTimes.length, blockCount))}</small>
          </div>
          ${schedule.meta ? `<span>${escape(schedule.meta)}</span>` : ""}
        </header>
        <div class="personal-schedule-import-snapshot__days">
          ${visibleDays.map(renderImportScheduleSnapshotDay).join("")}
          ${hiddenDayCount ? `
            <article class="personal-schedule-import-snapshot__day is-more">
              <span>Ещё ${escape(formatImportCount(hiddenDayCount, ["день", "дня", "дней"]))}</span>
              <small>Остальные дни сохранены внутри расписания Focus.</small>
            </article>
          ` : ""}
        </div>
      </section>
    `;
  }

  function renderImportScheduleSnapshotDay(day) {
    const times = Array.isArray(day?.times) ? day.times : [];
    const visibleTimes = times.slice(0, 2);
    const hiddenBlockCount = Math.max(0, times.length - visibleTimes.length);
    return `
      <article class="personal-schedule-import-snapshot__day">
        <span>${escape(day?.day || "День")}</span>
        ${visibleTimes.map(time => `<small>${escape(time)}</small>`).join("")}
        ${hiddenBlockCount ? `<small>Ещё ${escape(formatImportCount(hiddenBlockCount, ["блок", "блока", "блоков"]))} в этот день.</small>` : ""}
      </article>
    `;
  }

  function renderImportHistoryScheduleSummary(batch) {
    const schedule = getImportBatchPrimarySchedule(batch);
    const dayTimes = getImportScheduleDayTimes(schedule);
    if (!schedule || !dayTimes.length) return "";
    const blockCount = getImportScheduleBlockCount(dayTimes);
    const firstDay = dayTimes[0]?.day || "первый день";
    return `<small class="personal-schedule-history-import__summary">Расписание: ${escape(formatImportScheduleScope(dayTimes.length, blockCount))} · первый день: ${escape(firstDay)}</small>`;
  }

  function renderImportHistoryVersionSummary(batch) {
    if (isReplacementRollback(batch)) {
      const replacementBatch = getReplacementTargetBatch(batch);
      const replacementDate = replacementBatch ? formatDateTime(replacementBatch.appliedAt || replacementBatch.createdAt) : "";
      return `<small class="personal-schedule-history-import__summary">Заменён новой версией${replacementDate ? ` от ${escape(replacementDate)}` : ""}. Старая сетка сохранена для просмотра.</small>`;
    }
    if (isReplacementImport(batch)) {
      const sourceBatch = getImportBatchById(batch.replacesImportBatchId);
      const sourceDate = sourceBatch ? formatDateTime(sourceBatch.appliedAt || sourceBatch.createdAt) : "";
      return `<small class="personal-schedule-history-import__summary">Новая версия${sourceDate ? ` вместо импорта от ${escape(sourceDate)}` : ""}.</small>`;
    }
    return "";
  }

  function renderImportVersionTrail(batch) {
    if (isReplacementRollback(batch)) {
      const replacementBatch = getReplacementTargetBatch(batch);
      return `<p class="personal-schedule-import-detail__meta">Эта версия заменена новой${replacementBatch ? ` от ${escape(formatDateTime(replacementBatch.appliedAt || replacementBatch.createdAt))}` : ""}. В Focus активна новая версия, а эта сохранена только для просмотра.</p>`;
    }
    if (isReplacementImport(batch)) {
      const sourceBatch = getImportBatchById(batch.replacesImportBatchId);
      return `<p class="personal-schedule-import-detail__meta">Это обновленная версия${sourceBatch ? ` вместо импорта от ${escape(formatDateTime(sourceBatch.appliedAt || sourceBatch.createdAt))}` : ""}. Старая версия автоматически откатана.</p>`;
    }
    return "";
  }

  function getImportDisplayStatus(batch) {
    if (isReplacementRollback(batch)) return "replaced";
    if (isReplacementImport(batch)) return "updated";
    return batch?.status || "unknown";
  }

  function getImportStatusLabel(batch) {
    if (isReplacementRollback(batch)) return "Заменён";
    if (isReplacementImport(batch)) return "Новая версия";
    if (batch?.status === "rolled_back") return "Откатан";
    if (batch?.status === "applied") return "В Focus";
    return "Черновик";
  }

  function getImportResultTitle(batch) {
    if (isReplacementRollback(batch)) return "Заменён новой версией";
    if (isReplacementImport(batch)) return "Обновлено в Focus";
    if (batch?.status === "rolled_back") return "Импорт откатан";
    return "Добавлено в Focus";
  }

  function getImportResultDescription(batch) {
    if (isReplacementRollback(batch)) {
      return "Эта версия уже заменена. Старая сетка сохранена в истории, а в Focus активна новая версия.";
    }
    if (isReplacementImport(batch)) {
      return "Новая версия ритма добавлена в Focus, а предыдущая версия автоматически откатана.";
    }
    if (batch?.status === "rolled_back") {
      return "Эта пачка уже убрана из Focus. Черновик остался в истории, его можно открыть и импортировать заново.";
    }
    return "Пачка добавлена в Focus. Ниже видно, какие объекты созданы и где их искать.";
  }

  function getImportHistoryTitle(batch) {
    if (isReplacementRollback(batch)) return "Заменён новой версией";
    if (isReplacementImport(batch)) return "Новая версия применена";
    if (batch?.status === "rolled_back") return "Импорт откатан";
    return "Импорт применен";
  }

  function isReplacementRollback(batch) {
    return batch?.status === "rolled_back" && batch?.rolledBackReason === "replaced";
  }

  function isReplacementImport(batch) {
    return batch?.status === "applied" && Boolean(batch?.replacesImportBatchId);
  }

  function getReplacementTargetBatch(batch) {
    if (!isReplacementRollback(batch) || !batch?.replacedByImportBatchId) return null;
    return getImportBatchById(batch.replacedByImportBatchId);
  }

  function getImportBatchById(batchId) {
    return state.importBatches.find(batch => batch.id === batchId) || null;
  }

  function getImportVersionComparePair(batch) {
    if (isReplacementImport(batch)) {
      const sourceBatch = getImportBatchById(batch.replacesImportBatchId);
      return sourceBatch ? { sourceBatch, targetBatch: batch } : null;
    }
    if (isReplacementRollback(batch)) {
      const targetBatch = getReplacementTargetBatch(batch);
      return targetBatch ? { sourceBatch: batch, targetBatch } : null;
    }
    return null;
  }

  function canCompareImportSchedules(sourceBatch, targetBatch) {
    const sourceSchedule = getImportBatchPrimarySchedule(sourceBatch);
    const targetSchedule = getImportBatchPrimarySchedule(targetBatch);
    return Boolean(
      getImportScheduleDayTimes(sourceSchedule).length
      && getImportScheduleDayTimes(targetSchedule).length,
    );
  }

  function getSelectedCompareImportBatches() {
    const sourceBatch = getImportBatchById(selectedCompareImportIds.sourceBatchId);
    const targetBatch = getImportBatchById(selectedCompareImportIds.targetBatchId);
    if (sourceBatch && targetBatch) return { sourceBatch, targetBatch };
    return getDefaultCompareImportPair() || { sourceBatch: null, targetBatch: null };
  }

  function getDefaultCompareImportPair() {
    const replacementBatch = state.importBatches.find(isReplacementImport);
    if (replacementBatch) return getImportVersionComparePair(replacementBatch);
    const replacedBatch = state.importBatches.find(isReplacementRollback);
    return replacedBatch ? getImportVersionComparePair(replacedBatch) : null;
  }

  function compareImportScheduleVersions(sourceBatch, targetBatch) {
    const sourceSchedule = getImportBatchPrimarySchedule(sourceBatch);
    const targetSchedule = getImportBatchPrimarySchedule(targetBatch);
    const sourceDayTimes = getImportScheduleDayTimes(sourceSchedule);
    const targetDayTimes = getImportScheduleDayTimes(targetSchedule);
    const sourceBlocks = flattenImportScheduleBlocks(sourceSchedule);
    const targetBlocks = flattenImportScheduleBlocks(targetSchedule);
    if (!sourceBlocks.length || !targetBlocks.length) return null;

    const matchedSourceIds = new Set();
    const matchedTargetIds = new Set();

    for (const targetBlock of targetBlocks) {
      const sourceBlock = sourceBlocks.find(block => !matchedSourceIds.has(block.id) && block.exactKey === targetBlock.exactKey);
      if (sourceBlock) {
        matchedSourceIds.add(sourceBlock.id);
        matchedTargetIds.add(targetBlock.id);
      }
    }

    const changed = [];
    for (const targetBlock of targetBlocks) {
      if (matchedTargetIds.has(targetBlock.id)) continue;
      const sourceBlock = findCompareBlockMatch(sourceBlocks, matchedSourceIds, targetBlock, "dayTitleKey")
        || findCompareBlockMatch(sourceBlocks, matchedSourceIds, targetBlock, "dayTimeKey");
      if (!sourceBlock) continue;
      matchedSourceIds.add(sourceBlock.id);
      matchedTargetIds.add(targetBlock.id);
      changed.push({ type: "changed", source: sourceBlock, target: targetBlock });
    }

    const added = targetBlocks
      .filter(block => !matchedTargetIds.has(block.id))
      .map(block => ({ type: "added", block }));
    const removed = sourceBlocks
      .filter(block => !matchedSourceIds.has(block.id))
      .map(block => ({ type: "removed", block }));

    return {
      source: {
        dayCount: sourceDayTimes.length,
        blockCount: sourceBlocks.length,
      },
      target: {
        dayCount: targetDayTimes.length,
        blockCount: targetBlocks.length,
      },
      added: sortImportCompareItems(added),
      removed: sortImportCompareItems(removed),
      changed: sortImportCompareItems(changed),
      changeCount: added.length + removed.length + changed.length,
    };
  }

  function findCompareBlockMatch(blocks, matchedIds, targetBlock, keyName) {
    return blocks.find(block => !matchedIds.has(block.id) && block[keyName] === targetBlock[keyName]) || null;
  }

  function flattenImportScheduleBlocks(schedule) {
    return getImportScheduleDayTimes(schedule).flatMap((day, dayIndex) => {
      const dayLabel = String(day?.day || `День ${dayIndex + 1}`);
      const dayKey = normalizeImportCompareText(dayLabel) || `day-${dayIndex + 1}`;
      return (Array.isArray(day?.times) ? day.times : []).map((value, blockIndex) => {
        const parsed = parseImportScheduleLine(value);
        const range = parseImportedScheduleTimeRange(parsed.timeRange);
        const title = parsed.title || "Блок расписания";
        const timeRange = parsed.timeRange || "";
        const titleKey = normalizeImportCompareText(title);
        const timeKey = normalizeImportCompareText(timeRange);
        return {
          id: `${dayIndex}:${blockIndex}:${timeKey}:${titleKey}`,
          day: dayLabel,
          dayIndex,
          title,
          timeRange,
          startMinute: range?.startMinute ?? (blockIndex * 10),
          exactKey: `${dayKey}|${timeKey}|${titleKey}`,
          dayTitleKey: `${dayKey}|${titleKey}`,
          dayTimeKey: `${dayKey}|${timeKey}`,
        };
      });
    });
  }

  function normalizeImportCompareText(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function sortImportCompareItems(items) {
    return [...items].sort((left, right) => {
      const leftBlock = left.target || left.block || left.source;
      const rightBlock = right.target || right.block || right.source;
      return (leftBlock.dayIndex - rightBlock.dayIndex)
        || (leftBlock.startMinute - rightBlock.startMinute)
        || leftBlock.title.localeCompare(rightBlock.title, "ru");
    });
  }

  function renderImportVersionCompareGroup(title, items, emptyText) {
    return `
      <section class="personal-schedule-version-compare__group">
        <header>
          <strong>${escape(title)}</strong>
          <small>${escape(formatImportCount(items.length, ["блок", "блока", "блоков"]))}</small>
        </header>
        <div class="personal-schedule-version-compare__items">
          ${items.length ? items.map(renderImportVersionCompareItem).join("") : `<p class="modal-hint">${escape(emptyText)}</p>`}
        </div>
      </section>
    `;
  }

  function renderImportVersionCompareItem(item) {
    if (item.type === "changed") {
      return `
        <article class="personal-schedule-version-compare__item" data-ps-compare-change="changed">
          <span>${escape(item.target.day)}</span>
          <strong>${escape(item.target.title)}</strong>
          <small>Было: ${escape(formatImportCompareBlock(item.source))}</small>
          <small>Стало: ${escape(formatImportCompareBlock(item.target))}</small>
        </article>
      `;
    }
    const block = item.block;
    return `
      <article class="personal-schedule-version-compare__item" data-ps-compare-change="${escape(item.type)}">
        <span>${escape(block.day)}</span>
        <strong>${escape(block.title)}</strong>
        <small>${escape(block.timeRange || "Время не указано")}</small>
      </article>
    `;
  }

  function formatImportCompareBlock(block) {
    return [block.day, block.timeRange, block.title].filter(Boolean).join(" · ");
  }

  function renderImportDetailMetric(label, value) {
    return `
      <article class="personal-schedule-import-detail__metric">
        <span>${escape(label)}</span>
        <strong>${escape(value)}</strong>
      </article>
    `;
  }

  function renderImportScheduleDetailDay(day) {
    const times = Array.isArray(day?.times) ? day.times : [];
    return `
      <section class="personal-schedule-import-detail__day">
        <header>
          <strong>${escape(day?.day || "День")}</strong>
          <small>${escape(formatImportCount(times.length, ["блок", "блока", "блоков"]))}</small>
        </header>
        <div class="personal-schedule-import-detail__blocks">
          ${times.map(renderImportScheduleDetailBlock).join("")}
        </div>
      </section>
    `;
  }

  function renderImportScheduleDetailBlock(value, index) {
    const parsed = parseImportScheduleLine(value);
    return `
      <article class="personal-schedule-import-detail__block">
        <time>${escape(parsed.timeRange || `Блок ${index + 1}`)}</time>
        <span>${escape(parsed.title || "Блок расписания")}</span>
      </article>
    `;
  }

  function parseImportScheduleLine(value) {
    const text = String(value || "").trim();
    const match = text.match(/^(\d{1,2}:\d{2}\s*[-–—]\s*\d{1,2}:\d{2})\s*(?:·|-|–|—)?\s*(.*)$/);
    if (!match) return { timeRange: "", title: text };
    return {
      timeRange: match[1].replace(/\s*([-–—])\s*/g, "$1"),
      title: match[2] || "Блок расписания",
    };
  }

  function createDraftFromImportedSchedule(batch, schedule, dayTimes) {
    const sourceDraft = state.drafts.find(draft => draft.id === batch?.draftId) || null;
    const sourceIntake = normalizePersonalScheduleIntake(sourceDraft?.intake || state.intake, now());
    const createdAt = now().toISOString();
    const blocks = sortDraftBlocks(dayTimes.flatMap((day, dayIndex) => (
      (Array.isArray(day?.times) ? day.times : [])
        .map((value, blockIndex) => createImportedScheduleDraftBlock(value, day, dayIndex, blockIndex))
        .filter(Boolean)
    )));
    if (!blocks.length) return null;

    const variantId = createUiId("personal-schedule-variant");
    const draft = {
      id: createUiId("personal-schedule-draft"),
      status: "draft_ready",
      promptVersion: sourceDraft?.promptVersion || PERSONAL_SCHEDULE_PROMPT_VERSION,
      bigFiveVersion: sourceDraft?.bigFiveVersion || "import-copy",
      createdAt,
      updatedAt: createdAt,
      intake: structuredCloneSafe(sourceIntake),
      normalizedProfile: structuredCloneSafe(sourceDraft?.normalizedProfile || state.normalizedProfile || normalizePersonalScheduleProfile(sourceIntake, state.bigFive.scores)),
      source: "import_copy",
      sourceImportBatchId: batch.id,
      replacesImportBatchId: batch.id,
      sourceScheduleId: schedule.id || "",
      variants: [{
        id: variantId,
        title: "Копия сохраненного ритма",
        summary: "Все блоки из выбранного импорта открыты для правки.",
        recommendationReason: `Основано на импорте от ${formatDateTime(batch?.appliedAt || batch?.createdAt)}.`,
        blocks,
        validation: null,
      }],
      recommendedVariantId: variantId,
      selectedVariantId: variantId,
    };
    draft.variants[0].validation = validatePersonalScheduleDraft({
      draft: { blocks },
      intake: draft.intake,
      existingIntervals: getExistingIntervalsForDraft(draft),
    });
    return draft;
  }

  function createImportedScheduleDraftBlock(value, day, dayIndex, blockIndex) {
    const parsed = parseImportScheduleLine(value);
    const range = parseImportedScheduleTimeRange(parsed.timeRange);
    if (!range) return null;
    const title = parsed.title || "Блок расписания";
    const category = inferImportedScheduleBlockCategory(title);
    return {
      id: createUiId("personal-schedule-block"),
      title: title.slice(0, 120),
      category,
      priority: inferImportedScheduleBlockPriority(title, category),
      weekday: getImportScheduleWeekday(day?.day, dayIndex),
      weekdayLabel: getPersonalScheduleWeekdayLabel(getImportScheduleWeekday(day?.day, dayIndex)),
      startTime: formatTimeFromMinutes(range.startMinute),
      endTime: formatTimeFromMinutes(range.endMinute),
      startMinute: range.startMinute,
      endMinute: range.endMinute,
      durationMinutes: Math.max(MIN_BLOCK_MINUTES, range.endMinute - range.startMinute),
      flexibility: "semi_flexible",
      rationale: `Скопировано из сохраненного ритма, блок ${blockIndex + 1}.`,
      source: "import_copy",
    };
  }

  function parseImportedScheduleTimeRange(value) {
    const match = String(value || "").match(/^(\d{1,2}:\d{2})[-–—](\d{1,2}:\d{2})$/);
    if (!match) return null;
    const startMinute = parseTimeToMinutes(match[1]);
    const endMinute = parseTimeToMinutes(match[2]);
    if (!Number.isFinite(startMinute) || !Number.isFinite(endMinute) || endMinute <= startMinute) return null;
    return { startMinute, endMinute };
  }

  function getImportScheduleWeekday(value, fallbackIndex = 0) {
    const text = String(value || "").trim().toLowerCase();
    const weekdays = {
      "понедельник": 1,
      "пн": 1,
      "вторник": 2,
      "вт": 2,
      "среда": 3,
      "ср": 3,
      "четверг": 4,
      "чт": 4,
      "пятница": 5,
      "пт": 5,
      "суббота": 6,
      "сб": 6,
      "воскресенье": 7,
      "вс": 7,
    };
    return weekdays[text] || ((fallbackIndex % 7) + 1);
  }

  function inferImportedScheduleBlockCategory(title) {
    const text = String(title || "").toLowerCase();
    if (/(главн|фокус|глубок|приоритет|концентр)/.test(text)) return "focus";
    if (/(работ|встреч|созвон)/.test(text)) return "work";
    if (/(учеб|курс|обуч|читать|лекци)/.test(text)) return "study";
    if (/(спорт|движ|трениров|зарядк|прогул)/.test(text)) return "sport";
    if (/(дом|быт|семь|семья)/.test(text)) return "home";
    if (/(здоров|врач|сон)/.test(text)) return "health";
    if (/(отдых|восстанов|буфер|перерыв)/.test(text)) return "rest";
    return "goal";
  }

  function inferImportedScheduleBlockPriority(title, category) {
    const text = String(title || "").toLowerCase();
    if (category === "focus" || /(главн|важн|приоритет)/.test(text)) return "high";
    if (category === "rest" || /(буфер|перерыв)/.test(text)) return "low";
    return "medium";
  }

  function getImportBatchEntityCounts(batch) {
    const entities = batch?.entities || {};
    return {
      schedules: entities.schedules?.length || 0,
      tasks: entities.tasks?.length || 0,
      reminders: entities.reminders?.length || 0,
    };
  }

  function getImportBatchPrimarySchedule(batch) {
    const schedules = batch?.entities?.schedules;
    if (!Array.isArray(schedules) || !schedules.length) return null;
    return schedules.find(schedule => Array.isArray(schedule?.dayTimes) && schedule.dayTimes.length) || schedules[0] || null;
  }

  function getImportScheduleDayTimes(schedule) {
    return (Array.isArray(schedule?.dayTimes) ? schedule.dayTimes : [])
      .map(day => ({
        day: String(day?.day || "День"),
        times: (Array.isArray(day?.times) ? day.times : []).map(item => String(item || "").trim()).filter(Boolean),
      }))
      .filter(day => day.times.length);
  }

  function getImportScheduleBlockCount(dayTimes) {
    return (Array.isArray(dayTimes) ? dayTimes : []).reduce((sum, day) => sum + (Array.isArray(day?.times) ? day.times.length : 0), 0);
  }

  function formatImportScheduleScope(dayCount, blockCount) {
    return `${formatImportCount(dayCount, ["день", "дня", "дней"])} · ${formatImportCount(blockCount, ["блок", "блока", "блоков"])}`;
  }

  function formatImportCount(count, forms) {
    const safeCount = Math.max(0, Number(count) || 0);
    const mod100 = safeCount % 100;
    const mod10 = safeCount % 10;
    const form = mod100 >= 11 && mod100 <= 14
      ? forms[2]
      : mod10 === 1
        ? forms[0]
        : mod10 >= 2 && mod10 <= 4
          ? forms[1]
          : forms[2];
    return `${safeCount} ${form}`;
  }

  function renderImportImpactItem(title, count, hint) {
    return `
      <article class="personal-schedule-import-impact__item ${count ? "is-active" : ""}">
        <span>${escape(title)}</span>
        <strong>${escape(String(count))}</strong>
        <small>${escape(hint)}</small>
      </article>
    `;
  }

  function renderDraftDayPreview(blocks) {
    const groups = groupDraftBlocksByWeekday(blocks);
    if (!groups.length) return `<p class="modal-hint">В черновике пока нет блоков.</p>`;
    return `
      <div class="personal-schedule-day-preview" aria-label="Обзор по дням">
        ${groups.map(([weekday, items]) => `
          <section class="personal-schedule-day-column">
            <header>
              <strong>${escape(getPersonalScheduleWeekdayLabel(weekday))}</strong>
              <small>${items.length} бл. · ${escape(formatMinutesDuration(sumDraftBlockMinutes(items)))}</small>
            </header>
            <div class="personal-schedule-day-column__blocks">
              ${items.map(renderDraftDayBlock).join("")}
            </div>
          </section>
        `).join("")}
      </div>
    `;
  }

  function renderDraftDayBlock(block) {
    return `
      <article class="personal-schedule-day-block" data-ps-category="${escape(block.category || "event")}">
        <time>${escape(block.startTime || "")}-${escape(block.endTime || "")}</time>
        <strong>${escape(block.title || "Блок расписания")}</strong>
        <span>${escape(getCategoryLabel(block.category))} · ${escape(formatMinutesDuration(getDraftBlockDuration(block)))} · ${escape(getFlexibilityLabel(block.flexibility))}</span>
      </article>
    `;
  }

  function renderDraftBlockEditor(block, blockCount) {
    const fixed = block.flexibility === "fixed";
    return `
      <article class="personal-schedule-block-row" data-ps-block="${escape(block.id)}" data-ps-category="${escape(block.category || "event")}">
        <div class="personal-schedule-block-row__summary">
          <div class="personal-schedule-block-row__stamp">
            <span>${escape(block.weekdayLabel || getPersonalScheduleWeekdayLabel(block.weekday))}</span>
            <strong>${escape(block.startTime)}-${escape(block.endTime)}</strong>
          </div>
          <input data-ps-block-id="${escape(block.id)}" data-ps-block-field="title" value="${escape(block.title)}" type="text" aria-label="Название блока" />
        </div>
        <div class="personal-schedule-block-row__meta">
          <span>${escape(getCategoryLabel(block.category))}</span>
          <span>${escape(formatMinutesDuration(getDraftBlockDuration(block)))}</span>
          <span>${escape(getFlexibilityLabel(block.flexibility))}</span>
        </div>
        <div class="personal-schedule-block-row__time">
          <label>
            <span>Начало</span>
            <input data-ps-block-id="${escape(block.id)}" data-ps-block-field="startTime" value="${escape(block.startTime)}" type="time" aria-label="Время начала" />
          </label>
          <label>
            <span>Конец</span>
            <input data-ps-block-id="${escape(block.id)}" data-ps-block-field="endTime" value="${escape(block.endTime)}" type="time" aria-label="Время окончания" />
          </label>
        </div>
        <div class="personal-schedule-block-actions" aria-label="Быстрые правки блока">
          <button class="icon-button icon-button--tiny" type="button" data-ps-block-id="${escape(block.id)}" data-ps-block-action="earlier" aria-label="Сдвинуть раньше на 15 минут" title="Раньше на 15 минут"><span class="icon icon-arrow-left" aria-hidden="true"></span></button>
          <button class="icon-button icon-button--tiny" type="button" data-ps-block-id="${escape(block.id)}" data-ps-block-action="later" aria-label="Сдвинуть позже на 15 минут" title="Позже на 15 минут"><span class="icon icon-arrow-right" aria-hidden="true"></span></button>
          <button class="personal-schedule-block-action-chip" type="button" data-ps-block-id="${escape(block.id)}" data-ps-block-action="shorter" aria-label="Укоротить на 15 минут" title="Укоротить на 15 минут">-15</button>
          <button class="personal-schedule-block-action-chip" type="button" data-ps-block-id="${escape(block.id)}" data-ps-block-action="longer" aria-label="Удлинить на 15 минут" title="Удлинить на 15 минут">+15</button>
          <button class="icon-button icon-button--tiny ${fixed ? "is-active" : ""}" type="button" data-ps-block-id="${escape(block.id)}" data-ps-block-action="toggle-fixed" aria-label="${fixed ? "Сделать гибким" : "Закрепить время"}" title="${fixed ? "Сделать гибким" : "Закрепить время"}" aria-pressed="${String(fixed)}"><span class="icon ${fixed ? "icon-check" : "icon-edit"}" aria-hidden="true"></span></button>
          <button class="icon-button icon-button--tiny" type="button" data-ps-block-id="${escape(block.id)}" data-ps-block-action="remove" aria-label="Удалить блок" title="Удалить блок" ${blockCount <= 1 ? "disabled" : ""}><span class="icon icon-trash" aria-hidden="true"></span></button>
        </div>
        <small class="personal-schedule-block-row__note">${escape(block.rationale || "Учитывает ваши ответы и ограничения Focus.")}</small>
      </article>
    `;
  }

  function renderValidationIssues(validation) {
    const messages = getValidationMessages(validation);
    return `
      <div class="voice-status voice-status--bad">
        ${messages.map(message => `<div>${escape(message)}</div>`).join("")}
      </div>
    `;
  }

  function renderValidationErrors(errors) {
    const messages = getValidationMessages({ blockingConflicts: (errors || []).map(code => ({ code })) });
    return `
      <div class="voice-status voice-status--bad">
        ${messages.map(message => `<div>${escape(message)}</div>`).join("")}
      </div>
    `;
  }

  function getSelectedDraftValidation() {
    const draft = getSelectedDraft();
    const variant = getSelectedVariant(draft);
    if (!draft || !variant) return null;
    const validation = validatePersonalScheduleDraft({
      draft: { blocks: variant.blocks },
      intake: draft.intake,
      existingIntervals: getExistingIntervalsForDraft(draft),
    });
    variant.validation = validation;
    return validation;
  }

  function getValidationSummary(validation) {
    return getValidationMessages(validation).join(" ");
  }

  function getValidationErrorsSummary(errors) {
    return getValidationMessages({ blockingConflicts: (errors || []).map(code => ({ code })) }).join(" ");
  }

  function getValidationMessages(validation) {
    const conflicts = Array.isArray(validation?.blockingConflicts) ? validation.blockingConflicts : [];
    if (!conflicts.length) return ["Проверьте черновик расписания перед импортом."];
    return conflicts.map(getValidationMessage);
  }

  function getValidationMessage(conflict) {
    const code = typeof conflict === "string" ? conflict : conflict?.code;
    if (code === "invalid_time") return "Проверьте время блока: окончание должно быть позже начала.";
    if (code === "fixed_conflict") return "Блок пересекается с фиксированным событием Focus. Сдвиньте его перед импортом.";
    if (code === "draft_overlap") return "Два блока черновика пересекаются. Разведите их по времени перед импортом.";
    if (code === "sleep_below_minimum") {
      const sleep = Number.isFinite(conflict.sleepMinutes) ? conflict.sleepMinutes : null;
      const minimum = Number.isFinite(conflict.minimumSleepMinutes) ? conflict.minimumSleepMinutes : null;
      if (sleep !== null && minimum !== null) {
        return `Сон ниже заданного минимума: ${formatMinutesDuration(sleep)} из ${formatMinutesDuration(minimum)}.`;
      }
      return "Сон ниже заданного минимума. Измените время подъема или отбоя.";
    }
    if (code === "variant_missing") return "Выберите вариант расписания перед импортом.";
    if (code === "validation_failed") return "Черновик не прошел проверку. Вернитесь к расписанию и поправьте конфликтные блоки.";
    return "Проверьте черновик расписания перед импортом.";
  }

  function syncChoiceStates(root) {
    root.querySelectorAll(".choice-card").forEach(button => {
      const active = button.classList.contains("choice-card--active");
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function getStatusText() {
    if (state.lastError) return state.lastError.message;
    if (state.status === "draft_ready" && getSelectedDraft()?.source === "local_fallback") {
      return "Черновик готов. Focus собрал его локально на устройстве.";
    }
    const serviceText = lastStatus.status === "ok"
      ? "Сервис генерации готов"
      : "Сервис генерации проверяется";
    return `${getPersonalScheduleStateLabel(state.status)}. ${serviceText}.`;
  }

  function getTitleForStep(step) {
    return {
      mode: "Персональный ритм дня",
      period: "Период планирования",
      calendar: "Доступ к календарю",
      sleep: "Сон",
      work: "Работа",
      goals: "Приоритетные цели",
      energy: "Энергия и плотность",
      rest: "Отдых",
      "big-five-intro": "Профиль предпочтений",
      "big-five-question": "Профиль предпочтений",
      review: "Проверка",
      draft: "Черновик расписания",
      "confirm-import": "Подтверждение импорта",
      history: "История ритма дня",
      "import-detail": "Полный ритм дня",
    }[step] || "Персональный ритм дня";
  }
}

function withRuntimeDefaults(nextState) {
  return {
    ...nextState,
    drafts: Array.isArray(nextState?.drafts) ? nextState.drafts : [],
    history: Array.isArray(nextState?.history) ? nextState.history : [],
    importBatches: Array.isArray(nextState?.importBatches) ? nextState.importBatches : [],
    importOptions: {
      ...DEFAULT_IMPORT_OPTIONS,
      ...(nextState?.importOptions && typeof nextState.importOptions === "object" ? nextState.importOptions : {}),
    },
  };
}

function createUiId(prefix) {
  const random = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
}

function coerceInputValue(input) {
  if (input.type === "number") return Number(input.value);
  if (input.type === "checkbox") return input.checked;
  return input.value;
}

function getBigFiveScoreLabel(score) {
  return {
    1: "Совсем не согласен",
    2: "Скорее не согласен",
    3: "Нейтрально",
    4: "Скорее согласен",
    5: "Полностью согласен",
  }[score] || "";
}

function getModeLabel(value) {
  return {
    quick: "быстрый план",
    deep: "глубокий план",
  }[value] || value;
}

function getPeriodTypeLabel(value) {
  return {
    typical_day: "один день",
    work_week: "рабочая неделя",
    full_week: "полная неделя",
    custom: "свой период",
  }[value] || value;
}

function getPlanningStyleLabel(value) {
  return {
    compact: "плотный",
    balanced: "сбалансированный",
    spacious: "свободный",
  }[value] || value;
}

function getFlexibilityLabel(value) {
  return {
    fixed: "фиксировано",
    semi_flexible: "частично гибко",
    flexible: "гибко",
  }[value] || value;
}

function getCategoryLabel(value) {
  return {
    focus: "Фокус",
    work: "Работа",
    study: "Учеба",
    sport: "Спорт",
    home: "Дом",
    family: "Семья",
    health: "Здоровье",
    creative: "Творчество",
    rest: "Отдых",
    goal: "Цель",
    event: "Событие",
  }[value] || "Блок";
}

function createGoalDraft(index = 0) {
  return setGoalDefaults({
    id: `goal-${index + 1}-${Date.now().toString(16)}`,
    title: "Новая цель",
    category: "goal",
    priority: "medium",
    timesPerWeek: 1,
    minimumMinutes: 30,
    desiredMinutes: 45,
    preferredTime: "depends",
  });
}

function setGoalDefaults(goal) {
  goal.allowedWeekdays ||= [1, 2, 3, 4, 5, 6, 7];
  goal.skippable = goal.skippable === true;
  goal.splittable = goal.splittable === true;
  return goal;
}

function getAllowedOptionValue(value, options, fallback) {
  return options.some(([optionValue]) => optionValue === value) ? value : fallback;
}

function getGoalSummary(goal) {
  return [
    getCategoryLabel(goal.category),
    getPriorityLabel(goal.priority),
    `${clampNumber(goal.timesPerWeek || 1, 1, 14)} раз/нед.`,
    formatMinutesDuration(goal.desiredMinutes || 45),
    getPreferredTimeLabel(goal.preferredTime),
  ].join(" · ");
}

function getPriorityLabel(value) {
  return {
    high: "очень важно",
    medium: "важно",
    low: "можно реже",
  }[value] || "важно";
}

function getPreferredTimeLabel(value) {
  return {
    early_morning: "раннее утро",
    morning: "утро",
    day: "день",
    evening: "вечер",
    late_evening: "поздний вечер",
    depends: "любое время",
  }[value] || "любое время";
}

function getWeekdayShortLabel(weekday) {
  return {
    1: "Пн",
    2: "Вт",
    3: "Ср",
    4: "Чт",
    5: "Пт",
    6: "Сб",
    7: "Вс",
  }[Number(weekday)] || "";
}

function getDraftOverviewStats(blocks) {
  const source = Array.isArray(blocks) ? blocks : [];
  const uniqueDays = new Set(source.map(getDraftBlockWeekday));
  const workBlocks = source.filter(block => block.category === "work");
  const focusBlocks = source.filter(block => ["focus", "goal", "study"].includes(block.category));
  const goalBlocks = source.filter(block => block.category !== "rest");
  const restBlocks = source.filter(block => block.category === "rest");
  return {
    blockCount: source.length,
    dayCount: uniqueDays.size,
    totalMinutes: sumDraftBlockMinutes(source),
    workBlockCount: workBlocks.length,
    workMinutes: sumDraftBlockMinutes(workBlocks),
    focusBlockCount: focusBlocks.length,
    focusMinutes: sumDraftBlockMinutes(focusBlocks),
    goalBlockCount: goalBlocks.length,
    goalMinutes: sumDraftBlockMinutes(goalBlocks),
    restBlockCount: restBlocks.length,
    restMinutes: sumDraftBlockMinutes(restBlocks),
    fixedBlockCount: source.filter(block => block.flexibility === "fixed").length,
  };
}

function getDraftResultSummary(stats, blocks) {
  const groups = groupDraftBlocksByWeekday(blocks);
  if (!stats.blockCount) return "Черновик пока пустой.";
  const busiest = groups
    .map(([weekday, items]) => ({ weekday, minutes: sumDraftBlockMinutes(items) }))
    .sort((first, second) => second.minutes - first.minutes)[0];
  if (!busiest) return `${stats.blockCount} блоков распределены по ${stats.dayCount} дн.`;
  return `${stats.blockCount} блоков на ${stats.dayCount} дн.; самый плотный день: ${getPersonalScheduleWeekdayLabel(busiest.weekday)}, ${formatMinutesDuration(busiest.minutes)}.`;
}

function getDraftWhyItems(draft, variant, stats, blocks) {
  const intake = draft?.intake || {};
  const energy = intake.energy || {};
  const profile = draft?.normalizedProfile || {};
  const tuning = profile.bigFiveTuning || {};
  const focusBlock = sortDraftBlocks(blocks).find(block => ["focus", "goal", "study"].includes(block.category));
  const items = [];

  if (focusBlock) {
    items.push({
      title: "Главный приоритет",
      body: `${focusBlock.title} стоит ${getDraftBlockDayPartLabel(focusBlock)} (${focusBlock.startTime}-${focusBlock.endTime}), потому что выбран пик энергии: ${getEnergyPeakDisplayLabel(energy.peak)}.`,
    });
  }

  items.push({
    title: "Темп дня",
    body: `Плотность: ${getEnergyDensityDisplayLabel(energy.density)}; фокус-блок: ${energy.focusBlockMinutes || 60} мин.; перерыв: ${energy.breakMinutes || 10} мин.; буфер: ${energy.bufferMinutes || 0} мин.`,
  });

  items.push({
    title: "20 вопросов",
    body: tuning.skipped === false
      ? `Профиль выбрал стиль «${variant?.title || "Сбалансированный"}»: ${tuning.summary || "нейтральный стиль"}. Он влияет на порядок вариантов и небольшие поправки к фокусу, перерывам и буферам.`
      : "Опрос предпочтений пропущен, поэтому стиль черновика нейтральный: без дополнительных поправок к фокусу, перерывам и буферам.",
  });

  if (draft?.source === "local_fallback") {
    items.push({
      title: "Локальный черновик",
      body: "Сервис генерации не ответил, поэтому Focus собрал этот вариант на устройстве из ваших ответов. Черновик можно редактировать перед импортом.",
    });
  }

  if (intake.includeCalendar || stats.workBlockCount || stats.fixedBlockCount) {
    items.push({
      title: "Ограничения Focus",
      body: "Сон, рабочие окна и занятые интервалы сохраняются как ограничения, поэтому новые блоки подстраиваются вокруг них.",
    });
  }

  return items.slice(0, draft?.source === "local_fallback" ? 5 : 4);
}

function getDraftBlockDayPartLabel(block) {
  const minute = getDraftBlockStartMinute(block);
  if (minute < 11 * 60) return "утром";
  if (minute < 17 * 60) return "днем";
  if (minute < 21 * 60) return "вечером";
  return "поздно вечером";
}

function getEnergyPeakDisplayLabel(value) {
  return {
    early_morning: "раннее утро",
    morning: "утро",
    day: "день",
    evening: "вечер",
    late_evening: "поздний вечер",
    depends: "зависит от дня",
  }[value] || "утро";
}

function getEnergyDensityDisplayLabel(value) {
  return {
    light: "свободно",
    balanced: "сбалансированно",
    dense: "плотно",
  }[value] || "сбалансированно";
}

function getSleepWindowLabel(sleep) {
  const wake = sleep?.wakeTime || "07:00";
  const bed = sleep?.bedTime || "23:00";
  return `${bed}-${wake}`;
}

function getDraftDecisionWarningItems(intake, validation, stats, blocks, validationSummary = "") {
  const items = [];
  if (validation && validation.ok === false) {
    items.push({
      level: "bad",
      title: "Есть блокирующие конфликты",
      body: validationSummary || "Проверьте конфликтные блоки перед импортом.",
    });
  }

  const overloadedDays = getOverloadedDraftDays(intake, blocks);
  if (overloadedDays.length) {
    items.push({
      level: "warn",
      title: "Плотные дни",
      body: overloadedDays
        .map(day => `${getPersonalScheduleWeekdayLabel(day.weekday)}: ${formatMinutesDuration(day.minutes)}`)
        .join("; "),
    });
  }

  const goalCount = Array.isArray(intake?.goals) ? intake.goals.length : 0;
  if (goalCount && !stats.focusBlockCount) {
    items.push({
      level: "warn",
      title: "Фокус-блоки не выделены",
      body: "Цели есть в анкете, но в выбранном варианте нет отдельного фокусного блока.",
    });
  }

  if (!items.length) {
    items.push({
      level: "ok",
      title: "Без блокирующих конфликтов",
      body: "Интервалы не пересекаются с фиксированными событиями Focus.",
    });
  }
  return items;
}

function getOverloadedDraftDays(intake, blocks) {
  const threshold = getDraftDayLoadThreshold(intake);
  return groupDraftBlocksByWeekday(blocks)
    .map(([weekday, items]) => ({ weekday, minutes: sumDraftBlockMinutes(items) }))
    .filter(day => day.minutes > threshold)
    .slice(0, 3);
}

function getDraftDayLoadThreshold(intake) {
  const density = intake?.energy?.density;
  if (density === "light") return 9 * 60;
  if (density === "dense") return 12 * 60;
  return 10 * 60 + 30;
}

function groupDraftBlocksByWeekday(blocks) {
  const groups = new Map();
  for (const block of sortDraftBlocks(blocks)) {
    const weekday = getDraftBlockWeekday(block);
    if (!groups.has(weekday)) groups.set(weekday, []);
    groups.get(weekday).push(block);
  }
  return [...groups.entries()].sort(([first], [second]) => first - second);
}

function sortDraftBlocks(blocks) {
  return [...(Array.isArray(blocks) ? blocks : [])].sort((first, second) => {
    const weekdayDiff = getDraftBlockWeekday(first) - getDraftBlockWeekday(second);
    if (weekdayDiff) return weekdayDiff;
    return getDraftBlockStartMinute(first) - getDraftBlockStartMinute(second);
  });
}

function sumDraftBlockMinutes(blocks) {
  return (Array.isArray(blocks) ? blocks : []).reduce((total, block) => total + getDraftBlockDuration(block), 0);
}

function getDraftBlockWeekday(block) {
  const weekday = Number(block?.weekday);
  return Number.isInteger(weekday) && weekday >= 1 && weekday <= 7 ? weekday : 1;
}

function getDraftBlockStartMinute(block) {
  const parsed = Number.isFinite(block?.startMinute) ? Number(block.startMinute) : parseTimeToMinutes(block?.startTime);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getDraftBlockEndMinute(block) {
  const parsed = Number.isFinite(block?.endMinute) ? Number(block.endMinute) : parseTimeToMinutes(block?.endTime);
  return Number.isFinite(parsed) ? parsed : Math.min(MAX_DAY_MINUTE, getDraftBlockStartMinute(block) + MIN_BLOCK_MINUTES);
}

function getDraftBlockDuration(block) {
  return Math.max(0, getDraftBlockEndMinute(block) - getDraftBlockStartMinute(block));
}

function shiftDraftBlock(block, deltaMinutes) {
  const duration = Math.max(MIN_BLOCK_MINUTES, getDraftBlockDuration(block) || Number(block?.durationMinutes) || MIN_BLOCK_MINUTES);
  const latestStart = Math.max(0, MAX_DAY_MINUTE - duration);
  const start = clampNumber(getDraftBlockStartMinute(block) + deltaMinutes, 0, latestStart);
  return setDraftBlockTime(block, start, start + duration);
}

function resizeDraftBlock(block, deltaMinutes) {
  const start = getDraftBlockStartMinute(block);
  const currentEnd = getDraftBlockEndMinute(block);
  const end = clampNumber(currentEnd + deltaMinutes, start + MIN_BLOCK_MINUTES, MAX_DAY_MINUTE);
  return setDraftBlockTime(block, start, end);
}

function setDraftBlockTime(block, startMinute, endMinute) {
  return {
    ...block,
    startMinute,
    endMinute,
    startTime: formatTimeFromMinutes(startMinute),
    endTime: formatTimeFromMinutes(endMinute),
    durationMinutes: Math.max(0, endMinute - startMinute),
  };
}

function formatTimeFromMinutes(value) {
  const minutes = clampNumber(value, 0, MAX_DAY_MINUTE);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function getPath(source, path) {
  return path.split(".").reduce((value, part) => value?.[part], source);
}

function structuredCloneSafe(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function addDaysIso(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return isoDate;
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMinutesDuration(value) {
  const minutes = Math.max(0, Number(value) || 0);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} мин.`;
  if (!rest) return `${hours} ч.`;
  return `${hours} ч. ${rest} мин.`;
}

function formatDateTime(value) {
  const date = new Date(value || "");
  if (!Number.isFinite(date.getTime())) return "Дата неизвестна";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function defaultEscapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}
