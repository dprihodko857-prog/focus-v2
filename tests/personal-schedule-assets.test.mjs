import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const indexHtml = readFileSync("public/index.html", "utf8");
const appJs = readFileSync("public/js/app.js", "utf8");
const appCss = readFileSync("public/css/app.css", "utf8");
const syncJs = readFileSync("public/js/sync.js", "utf8");
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
  assert.match(appCss, /@media \(max-width: 760px\)[\s\S]*?\.personal-schedule-scale\s*{[\s\S]*?grid-template-columns:\s*1fr;/);
});

test("service worker caches Personal Schedule Planner modules", () => {
  assert.match(serviceWorker, /focus-pwa-v118/);
  assert.match(serviceWorker, /"\/js\/personal-schedule-planner\.js"/);
  assert.match(serviceWorker, /"\/js\/personal-schedule-ui\.js"/);
});
