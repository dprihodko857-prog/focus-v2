import {
  PERSONAL_SCHEDULE_BIG_FIVE_QUESTIONS,
  PERSONAL_SCHEDULE_PROMPT_VERSION,
  applyPersonalScheduleImportBatch,
  calculateBigFiveScores,
  collectPersonalScheduleExistingIntervals,
  createDefaultPersonalScheduleState,
  createPersonalScheduleAiRequest,
  createPersonalScheduleImportBatch,
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
];

const INTAKE_STEPS = UI_STEPS.slice(0, UI_STEPS.indexOf("review") + 1);

const DEFAULT_IMPORT_OPTIONS = Object.freeze({
  includeTasks: true,
  includeReminders: false,
});

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
        <h3>Идеальное расписание</h3>
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
      default:
        return renderModeStep();
    }
  };

  const renderModeStep = () => `
    <div class="choice-grid personal-schedule-choice-grid">
      ${renderChoiceCard("quick", "Быстрый план", "Основные ограничения и один практичный вариант.", state.intake.mode === "quick", "data-ps-mode")}
      ${renderChoiceCard("deep", "Глубокий план", "Добавляет профиль предпочтений и до трех вариантов.", state.intake.mode === "deep", "data-ps-mode")}
    </div>
    <p class="scenario-note">Запрос к AI идет через backend Focus. Секреты провайдера не попадают в браузер.</p>
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

  const renderGoalsStep = () => `
    <label class="field-block">
      <span>Цели</span>
      <textarea data-ps-goals rows="9" placeholder="Цель; категория; приоритет; раз в неделю; минут; лучшее время">${escape(formatGoalsText(state.intake.goals))}</textarea>
    </label>
    <p class="scenario-note">Одна цель на строку. Пример: Учеба; learning; high; 4; 60; morning.</p>
  `;

  const renderEnergyStep = () => {
    const energy = state.intake.energy;
    return `
      <div class="modal-form-grid modal-form-grid--compact">
        ${renderSelect("Пик энергии", "energy.peak", energy.peak, [
          ["early_morning", "Раннее утро"],
          ["morning", "Утро"],
          ["day", "День"],
          ["evening", "Вечер"],
          ["late_evening", "Поздний вечер"],
          ["depends", "Зависит от дня"],
        ])}
        ${renderSelect("Плотность", "energy.density", energy.density, [
          ["light", "Свободно"],
          ["balanced", "Сбалансированно"],
          ["dense", "Плотно"],
        ])}
        ${renderInput("Фокус-блок, минут", "energy.focusBlockMinutes", energy.focusBlockMinutes, "number")}
        ${renderInput("Перерыв, минут", "energy.breakMinutes", energy.breakMinutes, "number")}
        ${renderInput("Сложных блоков подряд", "energy.maxHardBlocksInRow", energy.maxHardBlocksInRow, "number")}
        ${renderInput("Буфер, минут", "energy.bufferMinutes", energy.bufferMinutes, "number")}
      </div>
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
      <p>Двадцать коротких ответов помогают настроить плотность расписания, буферы, совместные блоки и новизну. Баллы считаются в коде Focus до backend-запроса.</p>
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
        <span class="modal-kicker">Backend-запрос</span>
        <ul>
          <li>Промпт: ${escape(PERSONAL_SCHEDULE_PROMPT_VERSION)}</li>
          <li>Дневник: не отправляется</li>
          <li>Сырые заметки: не отправляются</li>
          <li>Названия личных событий: не отправляются</li>
          <li>Стиль профиля: ${escape(getPlanningStyleLabel(profile.planningStyle))}</li>
        </ul>
      </div>
      ${state.lastError ? `<div class="voice-status voice-status--bad">${escape(state.lastError.message)}</div>` : ""}
      ${lastStatus.status === "offline" ? `<div class="voice-status voice-status--warn">Backend недоступен. Генерация запустится только после восстановления синхронизации.</div>` : ""}
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
      existingIntervals: getExistingIntervals(),
    });
    variant.validation = validation;
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
        <div class="personal-schedule-block-editor">
          ${(variant.blocks || []).map(renderDraftBlockEditor).join("")}
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
        now: now(),
      })
      : { ok: false, batch: null };
    const entities = batchPreview.batch?.entities || { schedules: [], tasks: [], reminders: [] };
    return `
      <div class="personal-schedule-review">
        <h3>Предпросмотр импорта</h3>
        <p>Импорт создаст сущности Focus только после подтверждения. Существующие фиксированные события сохраняются.</p>
        <ul>
          <li>Расписания: ${entities.schedules.length}</li>
          <li>Задачи: ${entities.tasks.length}</li>
          <li>Напоминания: ${entities.reminders.length}</li>
        </ul>
        ${batchPreview.ok ? "" : `<div class="voice-status voice-status--bad">${escape((batchPreview.errors || ["validation_failed"]).join(", "))}</div>`}
      </div>
      <div class="personal-schedule-consent">
        ${renderImportCheckbox("Создать задачи из блоков", "includeTasks", state.importOptions.includeTasks)}
        ${renderImportCheckbox("Создать напоминания для сложных блоков", "includeReminders", state.importOptions.includeReminders)}
      </div>
    `;
  };

  const renderHistoryStep = () => {
    const appliedBatches = state.importBatches.filter(batch => batch.status === "applied" || batch.status === "rolled_back");
    return `
      <div class="personal-schedule-history">
        <div class="personal-schedule-history__header">
          <h3>История планировщика</h3>
          <div class="personal-schedule-feature__actions">
            <button class="secondary-button secondary-button--danger" type="button" data-ps-action="delete-profile">Очистить профиль</button>
            <button class="secondary-button secondary-button--danger" type="button" data-ps-action="delete-history">Очистить историю</button>
          </div>
        </div>
        <div>
          <span class="modal-kicker">Черновики</span>
          ${(state.drafts || []).length ? state.drafts.map(draft => `
            <article>
              <div>
                <strong>${escape(draft.variants?.[0]?.title || "Черновик")}</strong>
                <small>${escape(formatDateTime(draft.createdAt))} · ${escape(draft.promptVersion || PERSONAL_SCHEDULE_PROMPT_VERSION)}</small>
              </div>
              <button class="secondary-button secondary-button--compact" type="button" data-ps-open-draft="${escape(draft.id)}">Открыть</button>
            </article>
          `).join("") : `<p class="modal-hint">Сохраненных черновиков пока нет.</p>`}
        </div>
        <div>
          <span class="modal-kicker">Импорты</span>
          ${appliedBatches.length ? appliedBatches.map(batch => `
            <article>
              <div>
                <strong>${batch.status === "rolled_back" ? "Импорт откатан" : "Импорт применен"}</strong>
                <small>${escape(formatDateTime(batch.appliedAt || batch.rolledBackAt || batch.createdAt))}</small>
              </div>
              ${batch.status === "applied" ? `<button class="secondary-button secondary-button--compact" type="button" data-ps-rollback="${escape(batch.id)}">Откатить</button>` : ""}
            </article>
          `).join("") : `<p class="modal-hint">Импортов пока нет.</p>`}
        </div>
      </div>
    `;
  };

  const renderActions = () => {
    if (state.status === "generation_pending" || state.status === "importing") {
      return `<button class="secondary-button" type="button" disabled>Выполняется</button>`;
    }
    if (currentStep === "draft") {
      const hasDraft = Boolean(getSelectedDraft());
      return `
        <button class="secondary-button" type="button" data-ps-action="back">Назад</button>
        <button class="secondary-button" type="button" data-ps-action="regenerate">Сгенерировать заново</button>
        <button class="primary-button" type="button" data-ps-action="confirm-import" ${hasDraft ? "" : "disabled"}>Добавить в Focus</button>
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

    const goals = event.target.closest("[data-ps-goals]");
    if (goals) {
      const parsed = parseGoalsText(goals.value);
      if (parsed.length) setPath("goals", parsed);
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
      currentStep = "confirm-import";
      state.status = "ready_to_import";
      save();
      render();
    }
    if (action === "import") importDraft();
    if (action === "draft") {
      currentStep = "draft";
      render();
    }
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
    showStatus("Генерирую расписание через backend Focus.");

    const result = await sync?.generatePersonalSchedule?.(request);
    if (result?.status === "draft_ready" && result.draft) {
      const draft = {
        ...result.draft,
        source: result.provider || "mock",
      };
      state.drafts = [draft, ...state.drafts.filter(item => item.id !== draft.id)].slice(0, 10);
      state.selectedDraftId = draft.id;
      state.selectedVariantId = draft.selectedVariantId || draft.recommendedVariantId || draft.variants?.[0]?.id || "";
      state.status = "draft_ready";
      state.history = [{
        id: `history-${Date.now()}`,
        type: revision ? "revision" : "generation",
        promptVersion: result.promptVersion || PERSONAL_SCHEDULE_PROMPT_VERSION,
        provider: result.provider || "mock",
        createdAt: now().toISOString(),
      }, ...state.history].slice(0, 20);
      currentStep = "draft";
      await save();
      showStatus("Черновик расписания готов. Проверьте и отредактируйте его перед импортом.");
      render();
      return;
    }

    state.status = "generation_failed";
    state.lastError = {
      code: result?.status || "generation_failed",
      message: "Не удалось сгенерировать расписание. Проверьте доступность backend и попробуйте снова.",
      createdAt: now().toISOString(),
    };
    await save();
    showStatus(state.lastError.message);
    render();
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
      now: now(),
    });
    if (!batchResult.ok) {
      state.status = "validation_failed";
      state.lastError = {
        code: "validation_failed",
        message: batchResult.errors.join(", "),
        createdAt: now().toISOString(),
      };
      await save();
      render();
      return;
    }

    const data = getExistingData();
    const applied = applyPersonalScheduleImportBatch({
      batch: batchResult.batch,
      schedules: data.schedules,
      tasks: data.tasks,
      reminders: data.reminders,
      now: now(),
    });
    state.status = applied.status;
    state.importBatches = [applied.batch, ...state.importBatches].slice(0, 20);
    setCollections({
      schedules: applied.schedules,
      tasks: applied.tasks,
      reminders: applied.reminders,
      reason: "personal_schedule_import",
    });
    await save();
    showStatus("Расписание импортировано в Focus. Его можно откатить из истории планировщика.");
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
    showStatus("История планировщика расписания очищена.");
    currentStep = "mode";
    render();
  };

  const refreshProviderStatus = async ({ silent = false } = {}) => {
    const result = await sync?.getPersonalScheduleStatus?.();
    lastStatus = result || lastStatus;
    if (!silent && result?.status === "offline") {
      showStatus("Backend для генерации расписания недоступен.");
    }
    render();
    return lastStatus;
  };

  const getExistingIntervals = () => {
    const data = getExistingData();
    return collectPersonalScheduleExistingIntervals({
      schedules: data.schedules,
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
    variant.validation = validatePersonalScheduleDraft({ draft: { blocks: variant.blocks }, intake: draft.intake });
    draft.updatedAt = now().toISOString();
    state.status = "editing";
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

  function renderDraftBlockEditor(block) {
    return `
      <article class="personal-schedule-block-row" data-ps-block="${escape(block.id)}">
        <span>${escape(block.weekdayLabel || getPersonalScheduleWeekdayLabel(block.weekday))}</span>
        <input data-ps-block-id="${escape(block.id)}" data-ps-block-field="startTime" value="${escape(block.startTime)}" type="time" aria-label="Время начала" />
        <input data-ps-block-id="${escape(block.id)}" data-ps-block-field="endTime" value="${escape(block.endTime)}" type="time" aria-label="Время окончания" />
        <input data-ps-block-id="${escape(block.id)}" data-ps-block-field="title" value="${escape(block.title)}" type="text" aria-label="Название блока" />
        <small>${escape(getFlexibilityLabel(block.flexibility))} · ${escape(block.rationale || "")}</small>
      </article>
    `;
  }

  function renderValidationIssues(validation) {
    return `
      <div class="voice-status voice-status--bad">
        ${validation.blockingConflicts.map(conflict => escape(conflict.code)).join(", ")}
      </div>
    `;
  }

  function syncChoiceStates(root) {
    root.querySelectorAll(".choice-card").forEach(button => {
      const active = button.classList.contains("choice-card--active");
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function getStatusText() {
    if (state.lastError) return state.lastError.message;
    const providerText = lastStatus.status === "ok"
      ? `Провайдер backend: ${lastStatus.provider || "mock"}`
      : "Провайдер backend: ожидает проверки";
    return `${getPersonalScheduleStateLabel(state.status)}. ${providerText}.`;
  }

  function getTitleForStep(step) {
    return {
      mode: "Идеальное расписание",
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
      history: "История планировщика",
    }[step] || "Идеальное расписание";
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

function coerceInputValue(input) {
  if (input.type === "number") return Number(input.value);
  if (input.type === "checkbox") return input.checked;
  return input.value;
}

function formatGoalsText(goals) {
  return (Array.isArray(goals) ? goals : [])
    .map(goal => `${goal.title}; ${goal.category}; ${goal.priority}; ${goal.timesPerWeek}; ${goal.desiredMinutes}; ${goal.preferredTime}`)
    .join("\n");
}

function parseGoalsText(value) {
  return String(value || "").split(/\n+/)
    .map((line, index) => {
      const [title, category = "goal", priority = "medium", times = "1", minutes = "45", preferredTime = "depends"] = line.split(";").map(part => part.trim());
      if (!title) return null;
      return {
        id: `goal-${index + 1}`,
        title: title.slice(0, 120),
        category,
        priority,
        timesPerWeek: Number(times) || 1,
        minimumMinutes: Math.max(10, Number(minutes) || 30),
        desiredMinutes: Math.max(10, Number(minutes) || 45),
        preferredTime,
        allowedWeekdays: [1, 2, 3, 4, 5, 6, 7],
        skippable: false,
        splittable: false,
      };
    })
    .filter(Boolean);
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
