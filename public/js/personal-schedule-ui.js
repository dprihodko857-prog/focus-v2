import {
  PERSONAL_SCHEDULE_PROMPT_VERSION,
  applyPersonalScheduleImportBatch,
  collectPersonalScheduleExistingIntervals,
  createDefaultPersonalScheduleState,
  createDeterministicScheduleDraft,
  createPersonalScheduleAiRequest,
  createPersonalScheduleImportBatch,
  getPersonalScheduleStateLabel,
  getPersonalScheduleWeekdayLabel,
  normalizePersonalScheduleIntake,
  normalizePersonalScheduleState,
  rollbackPersonalScheduleImportBatch,
  validatePersonalScheduleDraft,
} from "./personal-schedule-planner.js";

export function createPersonalSchedulePlannerUi({
  storage,
  sync,
  getExistingData = () => ({}),
  setCollections = () => {},
  showStatus = () => {},
  escapeHtml: escape = defaultEscapeHtml,
  now = () => new Date(),
} = {}) {
  let state = createDefaultPersonalScheduleState(now());
  let openModal = null;
  let currentStep = "setup";
  let lastStatus = {
    status: "idle",
    providerConfigured: false,
    provider: null,
    promptVersion: PERSONAL_SCHEDULE_PROMPT_VERSION,
    features: {},
  };
  let savePromise = Promise.resolve();

  const hydrate = async () => {
    try {
      state = normalizePersonalScheduleState(await storage?.loadPersonalSchedulePlanner?.(), now());
    } catch {
      state = createDefaultPersonalScheduleState(now());
    }
    renderFeatureCard();
    return state;
  };

  const save = () => {
    state = {
      ...state,
      updatedAt: now().toISOString(),
    };
    savePromise = savePromise
      .catch(() => null)
      .then(() => storage?.savePersonalSchedulePlanner?.(state))
      .catch(() => null);
    return savePromise;
  };

  const setOpenModal = handler => {
    openModal = handler;
  };

  const bind = () => {
    document.querySelector("#personalScheduleFeature")?.addEventListener("click", event => {
      const action = event.target.closest("[data-ps-feature-action]");
      if (!action) return;
      event.preventDefault();
      if (action.dataset.psFeatureAction === "history") {
        open("history");
      } else if (action.dataset.psFeatureAction === "draft") {
        open("draft");
      } else {
        open(getSelectedDraft() ? "draft" : "setup");
      }
    });

    document.querySelector("#personalScheduleBody")?.addEventListener("click", handleBodyClick);
    document.querySelector("#personalScheduleBody")?.addEventListener("input", handleBodyInput);
    document.querySelector("#personalScheduleActions")?.addEventListener("click", handleActionClick);
  };

  const open = async (step = "setup") => {
    state = {
      ...state,
      status: state.status === "idle" ? "intake_in_progress" : state.status,
      lastOpenedAt: now().toISOString(),
    };
    currentStep = step;
    await save();
    render();
    openModal?.("personalSchedule");
    refreshProviderStatus({ silent: true }).then(render).catch(render);
  };

  const renderFeatureCard = () => {
    const card = document.querySelector("#personalScheduleFeature");
    if (!card) return;
    const draft = getSelectedDraft();
    const hasHistory = Boolean(state.importBatches?.length);
    card.innerHTML = `
      <span class="icon icon-sparkles" aria-hidden="true"></span>
      <div class="personal-schedule-feature__main">
        <h3>Идеальное расписание</h3>
        <p>Focus подготовит план дня или недели с учетом целей, нагрузки, сна и уже занятых окон.</p>
        <small>${escape(getPersonalScheduleStateLabel(state.status))} · ${escape(PERSONAL_SCHEDULE_PROMPT_VERSION)}</small>
      </div>
      <div class="personal-schedule-feature__actions">
        ${draft ? `<button class="secondary-button secondary-button--compact" type="button" data-ps-feature-action="draft">Открыть черновик</button>` : ""}
        ${hasHistory ? `<button class="secondary-button secondary-button--compact" type="button" data-ps-feature-action="history">История</button>` : ""}
        <button class="primary-button primary-button--compact" type="button" data-ps-feature-action="new">${draft ? "Создать новый" : "Составить расписание"}</button>
      </div>
    `;
  };

  const render = () => {
    const title = document.querySelector("#personalScheduleTitle");
    const status = document.querySelector("#personalScheduleStatus");
    const body = document.querySelector("#personalScheduleBody");
    const actions = document.querySelector("#personalScheduleActions");
    if (!title || !status || !body || !actions) return;

    title.textContent = getTitleForStep(currentStep);
    status.textContent = getStatusText();
    body.innerHTML = renderStep();
    actions.innerHTML = renderActions();
    renderFeatureCard();
  };

  const renderStep = () => {
    if (currentStep === "draft") return renderDraftStep();
    if (currentStep === "history") return renderHistoryStep();
    return renderSetupStep();
  };

  const renderSetupStep = () => {
    const intake = state.intake;
    return `
      <div class="personal-schedule-consent">
        <h3>Параметры плана</h3>
        <div class="choice-grid personal-schedule-choice-grid">
          ${renderChoiceCard("quick", "Быстрый план", "Один готовый вариант с базовыми настройками.", intake.mode === "quick", "data-ps-mode")}
          ${renderChoiceCard("deep", "Глубокий план", "До трех вариантов с более плотной проверкой целей и ритма.", intake.mode === "deep", "data-ps-mode")}
        </div>
        <div class="choice-grid personal-schedule-choice-grid">
          ${renderChoiceCard("typical_day", "Один день", "Шаблон для ближайшего дня.", intake.period.type === "typical_day", "data-ps-period")}
          ${renderChoiceCard("work_week", "Рабочая неделя", "Понедельник-пятница или выбранные рабочие дни.", intake.period.type === "work_week", "data-ps-period")}
          ${renderChoiceCard("full_week", "Полная неделя", "Все семь дней.", intake.period.type === "full_week", "data-ps-period")}
          ${renderChoiceCard("custom", "Период", "Своя дата начала и окончания.", intake.period.type === "custom", "data-ps-period")}
        </div>
      </div>

      <div class="modal-grid">
        ${renderInput("Дата начала", "period.startDate", intake.period.startDate, "date")}
        ${renderInput("Дата окончания", "period.endDate", intake.period.endDate, "date", intake.period.type !== "custom")}
        ${renderInput("Подъем", "sleep.wakeTime", intake.sleep.wakeTime, "time")}
        ${renderInput("Сон", "sleep.bedTime", intake.sleep.bedTime, "time")}
        ${renderInput("Минимум сна, минут", "sleep.minimumSleepMinutes", intake.sleep.minimumSleepMinutes, "number")}
        ${renderSelect("Пик энергии", "energy.peak", intake.energy.peak, [
          ["early_morning", "Раннее утро"],
          ["morning", "Утро"],
          ["day", "День"],
          ["evening", "Вечер"],
          ["late_evening", "Поздний вечер"],
          ["depends", "Зависит от дня"],
        ])}
        ${renderSelect("Плотность", "energy.density", intake.energy.density, [
          ["light", "Свободно"],
          ["balanced", "Сбалансированно"],
          ["dense", "Плотно"],
        ])}
        ${renderInput("Фокус-блок, минут", "energy.focusBlockMinutes", intake.energy.focusBlockMinutes, "number")}
        ${renderInput("Перерыв, минут", "energy.breakMinutes", intake.energy.breakMinutes, "number")}
        ${renderInput("Буфер, минут", "energy.bufferMinutes", intake.energy.bufferMinutes, "number")}
      </div>

      <label class="field-block">
        <span>Цели</span>
        <textarea data-ps-goals rows="7">${escape(formatGoalsText(intake.goals))}</textarea>
      </label>

      <div class="personal-schedule-chip-row">
        <label class="check-line">
          <input data-ps-include-calendar type="checkbox" ${intake.includeCalendar ? "checked" : ""} />
          <span>Учитывать существующие расписания и напоминания</span>
        </label>
      </div>
    `;
  };

  const renderDraftStep = () => {
    const draft = getSelectedDraft();
    if (!draft) {
      return `
        <section class="personal-schedule-review">
          <strong>Черновик еще не создан.</strong>
          <span>Заполните параметры и подготовьте расписание.</span>
        </section>
      `;
    }
    const selectedVariant = getSelectedVariant(draft);
    const validation = validatePersonalScheduleDraft({
      draft: { blocks: selectedVariant?.blocks || [] },
      intake: draft.intake,
    });
    return `
      <section class="personal-schedule-draft">
        <header>
          <div>
            <span class="modal-kicker">Черновик</span>
            <h3>${escape(selectedVariant?.title || "Расписание")}</h3>
            <p>${escape(selectedVariant?.recommendationReason || selectedVariant?.summary || "")}</p>
          </div>
          <span class="schedule-status-pill ${validation.ok ? "is-active" : ""}">${validation.ok ? "Проверено" : "Нужна правка"}</span>
        </header>
        <div class="personal-schedule-variants" aria-label="Варианты расписания">
          ${(draft.variants || []).map(variant => `
            <button class="${variant.id === selectedVariant?.id ? "is-selected" : ""}" type="button" data-ps-variant="${escape(variant.id)}">
              <strong>${escape(variant.title)}</strong>
              <span>${escape(variant.summary || "")}</span>
              ${variant.id === draft.recommendedVariantId ? "<small>Рекомендуемый</small>" : ""}
            </button>
          `).join("")}
        </div>
        ${validation.ok ? "" : renderValidationIssues(validation)}
        <div class="personal-schedule-block-editor">
          ${(selectedVariant?.blocks || []).map(renderDraftBlock).join("")}
        </div>
      </section>
    `;
  };

  const renderHistoryStep = () => `
    <section class="personal-schedule-history">
      <div class="personal-schedule-history__actions">
        <button class="secondary-button secondary-button--danger" type="button" data-ps-action="delete-profile">Очистить профиль</button>
        <button class="secondary-button secondary-button--danger" type="button" data-ps-action="delete-history">Очистить историю</button>
      </div>
      <div class="personal-schedule-history__list">
        ${(state.importBatches || []).length ? state.importBatches.map(batch => `
          <article>
            <div>
              <strong>${batch.status === "rolled_back" ? "Импорт отменен" : "Импорт добавлен"}</strong>
              <span>${escape(formatDateTime(batch.appliedAt || batch.rolledBackAt || batch.createdAt))}</span>
            </div>
            ${batch.status === "applied" ? `<button class="secondary-button secondary-button--compact" type="button" data-ps-rollback="${escape(batch.id)}">Откатить</button>` : ""}
          </article>
        `).join("") : `<p class="modal-hint">История пока пустая.</p>`}
      </div>
    </section>
  `;

  const renderActions = () => {
    if (currentStep === "draft") {
      return `
        <button class="secondary-button" type="button" data-ps-action="setup">Настроить заново</button>
        <button class="secondary-button" type="button" data-ps-action="generate">Пересобрать</button>
        <button class="primary-button" type="button" data-ps-action="import">Добавить в Focus</button>
      `;
    }
    if (currentStep === "history") {
      return `
        <button class="secondary-button" type="button" data-ps-action="setup">Новый план</button>
        <button class="primary-button" type="button" data-ps-action="draft" ${getSelectedDraft() ? "" : "disabled"}>К черновику</button>
      `;
    }
    return `
      <button class="secondary-button" type="button" data-ps-action="history" ${state.importBatches?.length ? "" : "disabled"}>История</button>
      <button class="primary-button" type="button" data-ps-action="generate">Подготовить расписание</button>
    `;
  };

  const handleBodyClick = event => {
    const mode = event.target.closest("[data-ps-mode]");
    if (mode) {
      state.intake = normalizePersonalScheduleIntake({ ...state.intake, mode: mode.dataset.psMode }, now());
      save();
      render();
      return;
    }

    const period = event.target.closest("[data-ps-period]");
    if (period) {
      state.intake = normalizePersonalScheduleIntake({
        ...state.intake,
        period: {
          ...state.intake.period,
          type: period.dataset.psPeriod,
        },
      }, now());
      save();
      render();
      return;
    }

    const variant = event.target.closest("[data-ps-variant]");
    if (variant) {
      state.selectedVariantId = variant.dataset.psVariant;
      const draft = getSelectedDraft();
      if (draft) draft.selectedVariantId = state.selectedVariantId;
      save();
      render();
    }

    const rollback = event.target.closest("[data-ps-rollback]");
    if (rollback) {
      rollbackImport(rollback.dataset.psRollback);
    }
  };

  const handleBodyInput = event => {
    const field = event.target.closest("[data-ps-field]");
    if (field) {
      const value = field.type === "number" ? Number(field.value) : field.value;
      const nextIntake = structuredCloneSafe(state.intake);
      setPath(nextIntake, field.dataset.psField, value);
      state.intake = normalizePersonalScheduleIntake(nextIntake, now());
      save();
      return;
    }

    const goals = event.target.closest("[data-ps-goals]");
    if (goals) {
      state.intake = normalizePersonalScheduleIntake({
        ...state.intake,
        goals: parseGoalsText(goals.value),
      }, now());
      save();
      return;
    }

    const calendar = event.target.closest("[data-ps-include-calendar]");
    if (calendar) {
      state.intake = normalizePersonalScheduleIntake({
        ...state.intake,
        includeCalendar: calendar.checked,
      }, now());
      save();
    }
  };

  const handleActionClick = event => {
    const action = event.target.closest("[data-ps-action]")?.dataset.psAction;
    if (!action) return;
    if (action === "setup") {
      currentStep = "setup";
      render();
    } else if (action === "draft") {
      currentStep = "draft";
      render();
    } else if (action === "history") {
      currentStep = "history";
      render();
    } else if (action === "generate") {
      generateDraft();
    } else if (action === "import") {
      importDraft();
    } else if (action === "delete-profile") {
      resetProfile();
    } else if (action === "delete-history") {
      state.importBatches = [];
      save();
      render();
    }
  };

  const generateDraft = async () => {
    state.status = "generation_pending";
    state.lastError = null;
    await save();
    render();

    const existing = getExistingIntervals();
    const request = createPersonalScheduleAiRequest({
      intake: state.intake,
      bigFiveScores: state.bigFive?.scores,
      existingIntervals: existing,
      now: now(),
    });

    let draft = null;
    try {
      const result = await sync?.generatePersonalSchedule?.(request);
      if (result?.status === "draft_ready" && result.draft) draft = result.draft;
    } catch {
      draft = null;
    }
    if (!draft) {
      draft = createDeterministicScheduleDraft({
        intake: state.intake,
        existingIntervals: existing,
        variantCount: state.intake.mode === "deep" ? 3 : 1,
        now: now(),
      });
    }

    state.drafts = [draft, ...(state.drafts || []).filter(item => item.id !== draft.id)].slice(0, 8);
    state.selectedDraftId = draft.id;
    state.selectedVariantId = draft.selectedVariantId || draft.recommendedVariantId || draft.variants?.[0]?.id || "";
    state.status = "draft_ready";
    currentStep = "draft";
    await save();
    render();
    showStatus("Черновик расписания готов.");
  };

  const importDraft = async () => {
    const draft = getSelectedDraft();
    const result = createPersonalScheduleImportBatch({
      draft,
      selectedVariantId: state.selectedVariantId,
      includeTasks: true,
      includeReminders: false,
      now: now(),
    });
    if (!result.ok) {
      state.status = "validation_failed";
      state.lastError = { message: "Черновик нужно проверить перед добавлением." };
      await save();
      render();
      return;
    }
    const existing = getExistingData();
    const applied = applyPersonalScheduleImportBatch({
      batch: result.batch,
      schedules: existing.schedules,
      tasks: existing.tasks,
      reminders: existing.reminders,
      now: now(),
    });
    setCollections({ ...applied, reason: "personal_schedule_import" });
    state.importBatches = [applied.batch, ...(state.importBatches || [])].slice(0, 12);
    state.status = "import_completed";
    currentStep = "history";
    await save();
    render();
  };

  const rollbackImport = async batchId => {
    const batch = (state.importBatches || []).find(item => item.id === batchId);
    if (!batch || batch.status === "rolled_back") return;
    const existing = getExistingData();
    const rolledBack = rollbackPersonalScheduleImportBatch({
      batch,
      schedules: existing.schedules,
      tasks: existing.tasks,
      reminders: existing.reminders,
      now: now(),
    });
    setCollections({ ...rolledBack, reason: "personal_schedule_rollback" });
    state.importBatches = (state.importBatches || []).map(item => item.id === batchId ? rolledBack.batch : item);
    state.status = "rolled_back";
    await save();
    render();
  };

  const resetProfile = async () => {
    state = {
      ...createDefaultPersonalScheduleState(now()),
      importBatches: state.importBatches || [],
    };
    currentStep = "setup";
    await save();
    render();
  };

  const refreshProviderStatus = async ({ silent = false } = {}) => {
    try {
      const result = await sync?.getPersonalScheduleStatus?.();
      if (result) lastStatus = result;
    } catch {
      lastStatus = {
        status: "offline",
        providerConfigured: false,
        provider: null,
        promptVersion: PERSONAL_SCHEDULE_PROMPT_VERSION,
        features: {},
      };
    }
    if (!silent) render();
  };

  const getSelectedDraft = () => {
    const drafts = Array.isArray(state.drafts) ? state.drafts : [];
    return drafts.find(draft => draft.id === state.selectedDraftId) || drafts[0] || null;
  };

  const getSelectedVariant = draft => {
    const variants = Array.isArray(draft?.variants) ? draft.variants : [];
    return variants.find(variant => variant.id === state.selectedVariantId)
      || variants.find(variant => variant.id === draft?.selectedVariantId)
      || variants[0]
      || null;
  };

  const getExistingIntervals = () => {
    const existing = getExistingData();
    return collectPersonalScheduleExistingIntervals({
      includeCalendar: state.intake.includeCalendar,
      schedules: existing.schedules,
      reminders: existing.reminders,
      birthdays: existing.birthdays,
    });
  };

  const getStatusText = () => {
    if (state.lastError?.message) return state.lastError.message;
    const provider = lastStatus.status === "ok" ? lastStatus.provider || "mock" : "локальный режим";
    return `${getPersonalScheduleStateLabel(state.status)}. Провайдер: ${provider}.`;
  };

  return {
    hydrate,
    setOpenModal,
    bind,
    renderFeatureCard,
  };

  function renderChoiceCard(value, title, description, active, attribute) {
    return `
      <button class="choice-card ${active ? "choice-card--active" : ""}" type="button" ${attribute}="${escape(value)}" aria-pressed="${String(active)}">
        <strong>${escape(title)}</strong>
        <span>${escape(description)}</span>
      </button>
    `;
  }

  function renderInput(label, path, value, type = "text", disabled = false) {
    return `
      <label class="field-block">
        <span>${escape(label)}</span>
        <input data-ps-field="${escape(path)}" type="${escape(type)}" value="${escape(value)}" ${disabled ? "disabled" : ""} />
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

  function renderDraftBlock(block) {
    return `
      <article class="personal-schedule-block-row">
        <span>${escape(block.weekdayLabel || getPersonalScheduleWeekdayLabel(block.weekday))}</span>
        <small>${escape(block.startTime)}-${escape(block.endTime)}</small>
        <input value="${escape(block.title)}" type="text" aria-label="Название блока" readonly />
        <small>${escape(block.rationale || block.category || "")}</small>
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

  function getTitleForStep(step) {
    return {
      setup: "Параметры расписания",
      draft: "Черновик расписания",
      history: "История расписаний",
    }[step] || "Идеальное расписание";
  }
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

function setPath(source, path, value) {
  const parts = String(path || "").split(".");
  let cursor = source;
  parts.slice(0, -1).forEach(part => {
    if (!cursor[part] || typeof cursor[part] !== "object") cursor[part] = {};
    cursor = cursor[part];
  });
  cursor[parts.at(-1)] = value;
}

function formatDateTime(value) {
  const date = new Date(value || "");
  if (!Number.isFinite(date.getTime())) return "дата неизвестна";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function structuredCloneSafe(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function defaultEscapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}
