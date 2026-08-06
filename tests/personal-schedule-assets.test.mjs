import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const indexHtml = readFileSync("public/index.html", "utf8");
const appJs = readFileSync("public/js/app.js", "utf8");
const appCss = readFileSync("public/css/app.css", "utf8");
const syncJs = readFileSync("public/js/sync.js", "utf8");
const plannerJs = readFileSync("public/js/personal-schedule-planner.js", "utf8");
const plannerUiJs = readFileSync("public/js/personal-schedule-ui.js", "utf8");
const serverJs = readFileSync("server/sync-server.mjs", "utf8");
const serviceWorker = readFileSync("public/service-worker.js", "utf8");

test("Useful exposes Personal Schedule Planner card and modal", () => {
  assert.match(indexHtml, /id="personalScheduleFeature"/);
  assert.match(indexHtml, /data-ps-feature-action="new"/);
  assert.match(indexHtml, /id="personalScheduleModal"/);
  assert.match(indexHtml, /id="personalScheduleBody"/);
  assert.match(indexHtml, /id="personalScheduleActions"/);
  assert.match(appJs, /createPersonalSchedulePlannerUi/);
  assert.match(appJs, /personalSchedule:\s*document\.querySelector\("#personalScheduleModal"\)/);
  assert.match(appJs, /personalSchedulePlannerUi\.setOpenModal\(openModal\)/);
  assert.match(appJs, /personalSchedulePlannerUi\.hydrate\(\)/);
  assert.match(indexHtml, /Персональный ритм дня/);
  assert.match(appJs, /Персональный ритм дня/);
  assert.match(plannerJs, /Персональный ритм дня/);
  assert.match(plannerUiJs, /Персональный ритм дня/);
  assert.doesNotMatch(indexHtml, /Идеальное расписание/);
  assert.doesNotMatch(appJs, /Идеальное расписание/);
  assert.doesNotMatch(plannerJs, /Идеальное расписание/);
  assert.doesNotMatch(plannerUiJs, /Идеальное расписание/);
});

test("Personal Schedule Planner uses existing Focus collections for import and rollback", () => {
  assert.match(appJs, /function applyPersonalScheduleCollections/);
  assert.match(appJs, /savedSchedules = schedules/);
  assert.match(appJs, /savedTasks = normalizeTaskList\(nextTasks\)/);
  assert.match(appJs, /localReminders = reminders/);
  assert.match(appJs, /persistSavedSchedules\(\)/);
  assert.match(appJs, /persistSavedTasks\(\)/);
  assert.match(appJs, /persistLocalReminders\(\)/);
  assert.doesNotMatch(indexHtml, /id="personalScheduleCalendar"/);
});

test("Personal Rhythm import keeps task clutter opt-in and labeled", () => {
  assert.match(plannerUiJs, /includeTasks:\s*false/);
  assert.match(plannerUiJs, /Дополнительно создать задачи из блоков/);
  assert.match(plannerUiJs, /По умолчанию добавляется одно расписание с блоками по дням/);
  assert.match(plannerUiJs, /function renderImportConfirmationPlan/);
  assert.match(plannerUiJs, /aria-label="План импорта"/);
  assert.match(plannerUiJs, /Перед добавлением/);
  assert.match(plannerUiJs, /key:\s*"tasks"/);
  assert.match(plannerUiJs, /data-ps-import-decision="\$\{escape\(key\)\}"/);
  assert.match(plannerUiJs, /Остаются выключены/);
  assert.match(plannerUiJs, /Внутри расписания/);
  assert.match(plannerUiJs, /После импорта эту пачку можно откатить/);
  assert.match(plannerJs, /function createTaskEntityFromBlock/);
  assert.match(plannerJs, /dateKey,\s*\n\s*createdAt/);
  assert.match(plannerJs, /formatImportBlockLabel/);
  assert.match(plannerJs, /Персональный ритм/);
  assert.match(appCss, /\.personal-schedule-import-confirmation\s*{/);
  assert.match(appCss, /\.personal-schedule-import-confirmation__decision\s*{/);
  assert.match(appCss, /\.personal-schedule-import-block-list\s*{/);
});

test("Personal Rhythm history can clean up imported task clutter", () => {
  assert.match(plannerJs, /export function cleanupPersonalScheduleImportedTasks/);
  assert.match(plannerUiJs, /data-ps-action="cleanup-imported-tasks"/);
  assert.match(plannerUiJs, /Убрать задачи ритма/);
  assert.match(plannerUiJs, /personal_schedule_task_cleanup/);
  assert.match(appJs, /personalScheduleBlockId/);
  assert.match(appJs, /Персональный ритм дня убрал задачи из старого импорта/);
});

test("Personal Rhythm history explains the latest applied import", () => {
  assert.match(plannerUiJs, /function renderLatestImportResult/);
  assert.match(plannerUiJs, /function renderImportScheduleSnapshot/);
  assert.match(plannerUiJs, /const renderImportScheduleDetailStep/);
  assert.match(plannerUiJs, /function parseImportScheduleLine/);
  assert.match(plannerUiJs, /function getImportBatchPrimarySchedule/);
  assert.match(plannerUiJs, /"import-detail"/);
  assert.match(plannerUiJs, /data-ps-open-import-schedule/);
  assert.match(plannerUiJs, /aria-label="Последний импорт"/);
  assert.match(plannerUiJs, /Добавлено в Focus/);
  assert.match(plannerUiJs, /История ритма дня/);
  assert.match(plannerUiJs, /Полный ритм дня/);
  assert.match(plannerUiJs, /Открыть полный ритм/);
  assert.match(plannerUiJs, /Открыть ритм/);
  assert.doesNotMatch(plannerUiJs, /История планировщика/);
  assert.match(plannerUiJs, /Что внутри расписания/);
  assert.match(plannerUiJs, /Остальные дни сохранены внутри расписания Focus/);
  assert.match(plannerUiJs, /personal-schedule-history-import__summary/);
  assert.match(plannerUiJs, /Где искать добавленное/);
  assert.match(plannerUiJs, /personal-schedule-import-result__destinations-head/);
  assert.match(plannerUiJs, /Раздел расписаний Focus/);
  assert.match(plannerUiJs, /data-ps-import-status/);
  assert.match(plannerUiJs, /расписаний: \$\{escape\(String\(counts\.schedules\)\)\}/);
  assert.match(appCss, /\.personal-schedule-import-result\s*{/);
  assert.match(appCss, /\.personal-schedule-import-snapshot\s*{/);
  assert.match(appCss, /\.personal-schedule-import-snapshot__days\s*{/);
  assert.match(appCss, /\.personal-schedule-history-import__summary\s*{/);
  assert.match(appCss, /\.personal-schedule-import-result__actions,[\s\S]*?\.personal-schedule-history-import__actions\s*{/);
  assert.match(appCss, /\.personal-schedule-history-import__actions\s*{/);
  assert.match(appCss, /\.personal-schedule-import-result__destinations-head\s*{/);
  assert.match(appCss, /\.personal-schedule-import-result__destinations\s*{/);
  assert.match(appCss, /\.personal-schedule-import-detail\s*{/);
  assert.match(appCss, /\.personal-schedule-import-detail__days\s*{/);
  assert.match(appCss, /\.personal-schedule-import-detail__block\s*{/);
  assert.match(appCss, /\.personal-schedule-history-import\[data-ps-import-status="rolled_back"\]\s*{/);
});

test("Personal Rhythm goals use understandable structured fields", () => {
  assert.match(plannerUiJs, /function renderGoalEditor/);
  assert.match(plannerUiJs, /data-ps-goal-field/);
  assert.match(plannerUiJs, /data-ps-goal-action="add"/);
  assert.match(plannerUiJs, /data-ps-goal-action="remove"/);
  assert.match(plannerUiJs, /Цели для ритма/);
  assert.match(plannerUiJs, /Сервис генерации проверяется/);
  assert.match(plannerUiJs, /Глубокая работа/);
  assert.match(plannerUiJs, /Название цели/);
  assert.match(plannerJs, /Главный приоритет дня/);
  assert.match(plannerUiJs, /Минут за раз/);
  assert.match(plannerUiJs, /Лучшее время/);
  assert.doesNotMatch(plannerUiJs, /placeholder="Цель; категория; приоритет; раз в неделю; минут; лучшее время"/);
  assert.doesNotMatch(plannerUiJs, /Одна цель на строку/);
  assert.doesNotMatch(plannerUiJs, /Учеба; learning; high; 4; 60; morning/);
  assert.doesNotMatch(plannerUiJs, /Провайдер backend/);
  assert.doesNotMatch(plannerJs, /Главное дело дня/);
  assert.match(appCss, /\.personal-schedule-goal-card\s*{/);
  assert.match(appCss, /\.personal-schedule-goal-grid\s*{/);
});

test("Personal Rhythm energy step explains how tempo settings shape the draft", () => {
  assert.match(plannerUiJs, /Темп дня/);
  assert.match(plannerUiJs, /Лучшее время для сложных дел/);
  assert.match(plannerUiJs, /Насколько плотно заполнять день/);
  assert.match(plannerUiJs, /Длина одного фокус-блока/);
  assert.match(plannerUiJs, /Запас между делами/);
  assert.match(plannerUiJs, /Двадцать коротких ответов не меняют ваши цели и рабочие часы/);
  assert.match(plannerUiJs, /Если он не ответит, Focus соберет локальный черновик/);
  assert.doesNotMatch(plannerUiJs, /backend-запроса/);
  assert.doesNotMatch(plannerUiJs, /Проверьте доступность backend/);
  assert.doesNotMatch(plannerUiJs, /Backend для генерации/);
  assert.doesNotMatch(plannerUiJs, /Backend/);
  assert.match(appCss, /\.personal-schedule-energy\s*{/);
  assert.match(appCss, /\.personal-schedule-energy-map\s*{/);
  assert.match(appCss, /\.field-block__hint\s*{/);
  assert.match(appCss, /#personalScheduleModal \.modal-body\s*{[\s\S]*?padding-bottom:\s*78px;/);
});

test("Personal Rhythm falls back to a local draft when generation service fails", () => {
  assert.match(plannerUiJs, /createDeterministicScheduleDraft/);
  assert.match(plannerUiJs, /createLocalFallbackDraft/);
  assert.match(plannerUiJs, /getGenerationFallbackReason/);
  assert.match(plannerUiJs, /source:\s*"local_fallback"/);
  assert.match(plannerUiJs, /Сервис генерации не ответил, поэтому Focus собрал локальный черновик на устройстве/);
  assert.match(plannerUiJs, /Черновик готов\. Focus собрал его локально на устройстве/);
  assert.match(plannerUiJs, /Локальный черновик/);
  assert.doesNotMatch(plannerUiJs, /generation_failed";\s*\n\s*state\.lastError/);
});

test("Personal Schedule Planner blocks import when existing Focus intervals conflict", () => {
  assert.match(plannerJs, /existingIntervals = \[\]/);
  assert.match(plannerJs, /validatePersonalScheduleDraft\(\{[\s\S]*?existingIntervals,/);
  assert.match(plannerUiJs, /existingIntervals: getExistingIntervals\(\)/);
  assert.match(plannerUiJs, /function getSelectedDraftValidation\(\)/);
  assert.match(plannerUiJs, /const canImport = hasDraft && validation\?\.ok;/);
  assert.match(plannerUiJs, /data-ps-action="confirm-import" \$\{canImport \? "" : "disabled"\}/);
  assert.match(plannerUiJs, /Блок пересекается с фиксированным событием Focus/);
  assert.match(plannerUiJs, /Два блока черновика пересекаются/);
});

test("Personal Schedule Planner backend endpoints and prompt version are wired", () => {
  assert.match(syncJs, /async getPersonalScheduleStatus\(\)/);
  assert.match(syncJs, /async generatePersonalSchedule\(requestBody = \{\}\)/);
  assert.match(syncJs, /\/sync\/personal-schedule\/status/);
  assert.match(syncJs, /\/sync\/personal-schedule\/generate/);
  assert.match(serverJs, /\/api\/sync\/personal-schedule\/status/);
  assert.match(serverJs, /\/api\/sync\/personal-schedule\/generate/);
  assert.match(serverJs, /validatePersonalScheduleAiRequest/);
  assert.match(serverJs, /createMockPersonalScheduleProvider/);
  assert.match(serverJs, /PERSONAL_SCHEDULE_PROMPT_VERSION/);
});

test("Personal Schedule Planner CSS supports wizard, variants, editor, and mobile layout", () => {
  assert.match(appCss, /\.personal-schedule-feature\s*{/);
  assert.match(appCss, /\.personal-schedule-choice-grid\s*{/);
  assert.match(appCss, /\.personal-schedule-scale\s*{/);
  assert.match(appCss, /\.personal-schedule-variants\s*{/);
  assert.match(appCss, /\.personal-schedule-block-row\s*{/);
  assert.match(appCss, /\.personal-schedule-block-row__summary\s*{/);
  assert.match(appCss, /\.personal-schedule-block-row__stamp\s*{/);
  assert.match(appCss, /\.personal-schedule-block-row__meta\s*{/);
  assert.match(appCss, /@media \(max-width: 760px\)[\s\S]*?\.personal-schedule-scale\s*{[\s\S]*?grid-template-columns:\s*1fr;/);
});

test("Personal Schedule draft review exposes day overview and quick block edits", () => {
  assert.match(plannerUiJs, /function renderDraftOverview/);
  assert.match(plannerUiJs, /function renderDraftResultBrief/);
  assert.match(plannerUiJs, /function renderDraftRhythmSummary/);
  assert.match(plannerUiJs, /function renderDraftWhyPanel/);
  assert.match(plannerUiJs, /function renderDraftDecisionWarnings/);
  assert.match(plannerUiJs, /function renderDraftImportPreview/);
  assert.match(plannerUiJs, /Что попадёт в Focus/);
  assert.match(plannerUiJs, /Итог опроса/);
  assert.match(plannerUiJs, /Краткий ритм дня/);
  assert.match(plannerUiJs, /Почему так составлено/);
  assert.match(plannerUiJs, /Главный приоритет/);
  assert.match(plannerUiJs, /20 вопросов/);
  assert.match(plannerUiJs, /Плотные дни/);
  assert.match(plannerUiJs, /function renderDraftDayPreview/);
  assert.match(plannerUiJs, /personal-schedule-block-row__summary/);
  assert.match(plannerUiJs, /personal-schedule-block-row__stamp/);
  assert.match(plannerUiJs, /personal-schedule-block-row__meta/);
  assert.match(plannerUiJs, /data-ps-category/);
  assert.match(plannerUiJs, /data-ps-block-action="earlier"/);
  assert.match(plannerUiJs, /data-ps-block-action="later"/);
  assert.match(plannerUiJs, /data-ps-block-action="shorter"/);
  assert.match(plannerUiJs, /data-ps-block-action="longer"/);
  assert.match(plannerUiJs, /data-ps-block-action="toggle-fixed"/);
  assert.match(plannerUiJs, /data-ps-block-action="remove"/);
  assert.match(plannerUiJs, /validateEditedVariant\(draft, variant\)/);
  assert.match(appCss, /\.personal-schedule-draft-overview\s*{/);
  assert.match(appCss, /\.personal-schedule-result-brief\s*{/);
  assert.match(appCss, /\.personal-schedule-rhythm-summary\s*{/);
  assert.match(appCss, /\.personal-schedule-why-panel\s*{/);
  assert.match(appCss, /\.personal-schedule-why-list\s*{/);
  assert.match(appCss, /\.personal-schedule-import-impact\s*{/);
  assert.match(appCss, /\.personal-schedule-warning-list\s*{/);
  assert.match(appCss, /\.personal-schedule-day-preview\s*{/);
  assert.match(appCss, /\.personal-schedule-block-actions\s*{/);
  assert.match(appCss, /\.personal-schedule-block-row__summary\s*{/);
  assert.match(appCss, /\.personal-schedule-block-row__stamp\s*{/);
  assert.match(appCss, /\.personal-schedule-block-row__meta\s*{/);
  assert.match(appCss, /\.personal-schedule-import-confirmation\s*{/);
  assert.match(appCss, /\.personal-schedule-import-confirmation__grid\s*{/);
  assert.match(appCss, /\.personal-schedule-import-block\s*{/);
});

test("service worker caches Personal Schedule Planner modules", () => {
  assert.match(serviceWorker, /focus-pwa-v168/);
  assert.match(serviceWorker, /"\/js\/personal-schedule-planner\.js"/);
  assert.match(serviceWorker, /"\/js\/personal-schedule-ui\.js"/);
});
