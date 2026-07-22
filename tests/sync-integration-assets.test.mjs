import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const appJs = readFileSync("public/js/app.js", "utf8");
const indexHtml = readFileSync("public/index.html", "utf8");
const serviceWorker = readFileSync("public/service-worker.js", "utf8");

test("app connects schedule persistence to the sync client", () => {
  assert.match(appJs, /import \{ createFocusAuthClient \} from "\.\/auth\.js";/);
  assert.match(appJs, /import \{ createFocusSyncClient \} from "\.\/sync\.js";/);
  assert.match(appJs, /createFocusAuthClient\(\)/);
  assert.match(appJs, /createFocusSyncClient\(\)/);
  assert.match(appJs, /scheduleSync\.syncSchedules/);
  assert.match(appJs, /scheduleSync\.pushSchedules/);
  assert.match(appJs, /scheduleSync\.getPushSubscriptionStatus/);
  assert.match(appJs, /scheduleSync\.getReminderDeliveryStatus/);
  assert.match(appJs, /scheduleSync\.getPushEvents/);
  assert.match(appJs, /scheduleSync\.sendTestPushNotification/);
});

test("service worker caches sync client as part of the PWA shell", () => {
  assert.match(serviceWorker, /focus-pwa-v39/);
  assert.match(serviceWorker, /"\/js\/auth\.js"/);
  assert.match(serviceWorker, /"\/js\/sync\.js"/);
  assert.match(serviceWorker, /"\/js\/notifications\.js"/);
  assert.match(serviceWorker, /addEventListener\("push"/);
});

test("service worker does not cache sync API responses", () => {
  assert.match(serviceWorker, /url\.pathname\.startsWith\("\/api\/"\)/);
});

test("settings expose the sync account connection modal", () => {
  assert.match(indexHtml, /data-open-modal="sync"/);
  assert.match(indexHtml, /id="syncModal"/);
  assert.match(indexHtml, /id="authStatus"/);
  assert.match(indexHtml, /id="authLoginButton"/);
  assert.match(indexHtml, /id="authLogoutButton"/);
  assert.match(indexHtml, /id="syncAccountCode"/);
  assert.match(indexHtml, /id="syncConnectInput"/);
  assert.match(indexHtml, /id="syncAccountName"/);
  assert.match(indexHtml, /id="syncDeviceName"/);
  assert.match(indexHtml, /id="syncDeviceList"/);
  assert.match(indexHtml, /id="syncProfileSaveButton"/);
  assert.match(indexHtml, /id="deviceCheckSummary"/);
  assert.match(indexHtml, /id="deviceCheckList"/);
  assert.match(indexHtml, /id="deviceCheckRefreshButton"/);
  assert.match(indexHtml, /id="deviceCheckTestButton"/);
  assert.match(indexHtml, /id="deviceCheckReminderButton"/);
  assert.match(appJs, /connectSyncAccount/);
  assert.match(appJs, /refreshAuthSession/);
  assert.match(appJs, /logoutAuthSession/);
  assert.match(appJs, /refreshSyncAccountProfile/);
  assert.match(appJs, /saveSyncAccountProfile/);
  assert.match(appJs, /function getDeviceCheckItems/);
  assert.match(appJs, /function renderDeviceCheck/);
  assert.match(appJs, /function refreshDeviceCheck/);
});

test("sidebar exposes the useful services hub", () => {
  assert.match(indexHtml, /data-open-modal="useful"/);
  assert.match(indexHtml, /id="usefulModal"/);
  assert.match(indexHtml, /Шаблоны дня/);
  assert.match(appJs, /useful:\s*document\.querySelector\("#usefulModal"\)/);
});

test("reminder modal exposes local notification controls", () => {
  assert.match(appJs, /createFocusNotifications\(\)/);
  assert.match(appJs, /saveLocalReminder/);
  assert.match(appJs, /syncSavedReminders/);
  assert.match(appJs, /registerServerPushSubscription/);
  assert.match(appJs, /refreshReminderPushDiagnostics/);
  assert.match(appJs, /renderReminderPushDiagnostics/);
  assert.match(appJs, /function getReminderDeliveryDiagnosticItem/);
  assert.match(indexHtml, /id="reminderStatus"/);
  assert.match(indexHtml, /id="reminderPermissionButton"/);
  assert.match(indexHtml, /id="reminderTestPushButton"/);
  assert.match(indexHtml, /id="reminderSaveButton"/);
  assert.match(indexHtml, /id="reminderPushSummary"/);
  assert.match(indexHtml, /id="reminderPushDiagnostics"/);
  assert.match(indexHtml, /id="reminderPushEnableButton"/);
  assert.match(indexHtml, /id="reminderPushRefreshButton"/);
  assert.match(indexHtml, /id="reminderPushTestButton"/);
});

test("reminders section exposes list management controls", () => {
  assert.match(indexHtml, /data-open-modal="reminders"/);
  assert.match(indexHtml, /id="remindersModal"/);
  assert.match(indexHtml, /id="reminderFilters"/);
  assert.match(indexHtml, /id="savedRemindersList"/);
  assert.match(appJs, /renderReminderList/);
  assert.match(appJs, /prepareReminderEdit/);
  assert.match(appJs, /data-delete-reminder/);
  assert.match(appJs, /scheduleSync\.pushReminders/);
});

test("today tasks persist through IndexedDB and sync", () => {
  assert.match(indexHtml, /id="taskText"/);
  assert.match(indexHtml, /id="taskLabel"/);
  assert.match(indexHtml, /id="taskSaveButton"/);
  assert.match(appJs, /hydrateSavedTasks/);
  assert.match(appJs, /saveTodayTask/);
  assert.match(appJs, /scheduleStorage\.saveTasks/);
  assert.match(appJs, /scheduleSync\.syncTasks/);
  assert.match(appJs, /scheduleSync\.pushTasks/);
});

test("notes section persists through IndexedDB and sync", () => {
  assert.match(indexHtml, /data-open-modal="notes"/);
  assert.match(indexHtml, /id="notesModal"/);
  assert.match(indexHtml, /id="savedNotesList"/);
  assert.match(indexHtml, /id="noteText"/);
  assert.match(indexHtml, /id="noteSaveButton"/);
  assert.match(appJs, /hydrateSavedNotes/);
  assert.match(appJs, /saveNote/);
  assert.match(appJs, /data-delete-note/);
  assert.match(appJs, /scheduleStorage\.saveNotes/);
  assert.match(appJs, /scheduleSync\.syncNotes/);
  assert.match(appJs, /scheduleSync\.pushNotes/);
});

test("birthdays section persists through IndexedDB, sync, and calendar events", () => {
  assert.match(indexHtml, /data-open-modal="birthdays"/);
  assert.match(indexHtml, /id="birthdaysModal"/);
  assert.match(indexHtml, /id="savedBirthdaysList"/);
  assert.match(indexHtml, /id="birthdayName"/);
  assert.match(indexHtml, /id="birthdayDate"/);
  assert.match(indexHtml, /id="birthdayReminder"/);
  assert.match(indexHtml, /id="birthdaySaveButton"/);
  assert.match(appJs, /hydrateSavedBirthdays/);
  assert.match(appJs, /saveBirthday/);
  assert.match(appJs, /getBirthdaysForDate/);
  assert.match(appJs, /getCalendarMarkers/);
  assert.match(appJs, /scheduleStorage\.saveBirthdays/);
  assert.match(appJs, /scheduleSync\.syncBirthdays/);
  assert.match(appJs, /scheduleSync\.pushBirthdays/);
});

test("diary section persists through IndexedDB, sync, and calendar events", () => {
  assert.match(indexHtml, /data-open-modal="diary"/);
  assert.match(indexHtml, /id="diaryModal"/);
  assert.match(indexHtml, /id="savedDiaryList"/);
  assert.match(indexHtml, /id="diaryEntryModal"/);
  assert.match(indexHtml, /id="diaryDate"/);
  assert.match(indexHtml, /id="diaryText"/);
  assert.match(indexHtml, /id="diarySaveButton"/);
  assert.match(appJs, /hydrateSavedDiaryEntries/);
  assert.match(appJs, /saveDiaryEntry/);
  assert.match(appJs, /getDiaryEntriesForDate/);
  assert.match(appJs, /data-open-diary-entry-for-day/);
  assert.match(appJs, /scheduleStorage\.saveDiaryEntries/);
  assert.match(appJs, /scheduleSync\.syncDiaryEntries/);
  assert.match(appJs, /scheduleSync\.pushDiaryEntries/);
});

test("diary section is protected by a four digit PIN gate", () => {
  assert.match(indexHtml, /id="diaryUnlockModal"/);
  assert.match(indexHtml, /id="diaryUnlockPin"/);
  assert.match(indexHtml, /id="diaryUnlockButton"/);
  assert.match(indexHtml, /id="diaryPinModal"/);
  assert.match(indexHtml, /id="diaryPinNew"/);
  assert.match(indexHtml, /id="diaryPinConfirm"/);
  assert.match(indexHtml, /id="diaryPinSetupButton"/);
  assert.match(indexHtml, /id="diaryLockButton"/);
  assert.match(appJs, /isValidDiaryPin/);
  assert.match(appJs, /hashDiaryPin/);
  assert.match(appJs, /verifyDiaryPin/);
  assert.match(appJs, /unlockDiary/);
  assert.match(appJs, /scheduleStorage\.saveDiaryPinSettings/);
});
