import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const appJs = readFileSync("public/js/app.js", "utf8");
const appCss = readFileSync("public/css/app.css", "utf8");
const syncJs = readFileSync("public/js/sync.js", "utf8");
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
  assert.match(serviceWorker, /focus-pwa-v58/);
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
  assert.match(indexHtml, /id="syncCodeCopyButton"/);
  assert.match(indexHtml, /id="syncConnectInput"/);
  assert.match(indexHtml, /id="syncAccountName"/);
  assert.match(indexHtml, /id="syncDeviceName"/);
  assert.match(indexHtml, /id="syncDeviceList"/);
  assert.match(indexHtml, /id="syncProfileSaveButton"/);
  assert.match(indexHtml, /id="syncDisconnectButton"/);
  assert.match(indexHtml, /id="deviceCheckSummary"/);
  assert.match(indexHtml, /id="deviceCheckList"/);
  assert.match(indexHtml, /id="deviceCheckRefreshButton"/);
  assert.match(indexHtml, /id="deviceCheckTestButton"/);
  assert.match(indexHtml, /id="deviceCheckReminderButton"/);
  assert.match(appJs, /connectSyncAccount/);
  assert.match(appJs, /copySyncAccountCode/);
  assert.match(appJs, /refreshAuthSession/);
  assert.match(appJs, /logoutAuthSession/);
  assert.match(appJs, /refreshSyncAccountProfile/);
  assert.match(appJs, /saveSyncAccountProfile/);
  assert.match(appJs, /disconnectSyncAccount/);
  assert.match(appJs, /function getDeviceCheckItems/);
  assert.match(appJs, /function renderDeviceCheck/);
  assert.match(appJs, /function refreshDeviceCheck/);
});

test("settings can copy the sync account code", () => {
  assert.match(indexHtml, /class="sync-code-field"/);
  assert.match(indexHtml, /id="syncCodeCopyButton" disabled/);
  assert.match(appCss, /\.sync-code-field\s*{/);
  assert.match(appJs, /function copySyncAccountCode/);
  assert.match(appJs, /navigator\.clipboard\.writeText\(accountId\)/);
  assert.match(appJs, /accountCode\?\.select\(\)/);
  assert.match(appJs, /Код синхронизации скопирован/);
  assert.match(appJs, /Код выделен\. Скопируйте его вручную/);
  assert.match(appJs, /copyButton\.disabled = !accountId/);
  assert.match(appJs, /document\.querySelector\("#syncCodeCopyButton"\)\?\.addEventListener\("click"/);
});

test("settings can disconnect code-based sync without clearing local data", () => {
  assert.match(indexHtml, /id="syncDisconnectButton" hidden/);
  assert.match(appCss, /\.sync-account-actions\s*{/);
  assert.match(appCss, /\.secondary-button--danger\s*{/);
  assert.match(appJs, /async function disconnectSyncAccount/);
  assert.match(appJs, /window\.confirm\("Отключить это устройство от синхронизации\? Локальные данные останутся на устройстве\."\)/);
  assert.match(appJs, /scheduleSync\.disconnectCurrentDevice\(\)/);
  assert.match(appJs, /scheduleSync\.clearAccountId\(\)/);
  assert.match(appJs, /syncAccountProfile = null/);
  assert.match(appJs, /resetSyncCollectionStates\(\)/);
  assert.match(appJs, /удалено из списка устройств/);
  assert.match(appJs, /Локальные данные остались на устройстве/);
  assert.match(appJs, /document\.querySelector\("#syncDisconnectButton"\)\?\.addEventListener\("click"/);
});

test("settings expose per-collection sync status diagnostics", () => {
  assert.match(indexHtml, /id="syncDataSummary"/);
  assert.match(indexHtml, /id="syncDataList"/);
  assert.match(indexHtml, /id="syncDataRefreshButton"/);
  assert.match(appCss, /\.sync-data-panel\s*{/);
  assert.match(appCss, /\.sync-data-grid\s*{/);
  assert.match(appCss, /\.sync-data-status--ok\s*{/);
  assert.match(appCss, /\.sync-data-status--warn\s*{/);
  assert.match(appCss, /\.sync-data-status--bad\s*{/);
  assert.match(appJs, /const syncCollectionItems = \[/);
  assert.match(appJs, /const syncCollectionStates = Object\.fromEntries/);
  assert.match(appJs, /function setSyncCollectionState/);
  assert.match(appJs, /function updateSyncCollectionFromResult/);
  assert.match(appJs, /function renderSyncDataStatus/);
  assert.match(appJs, /function refreshSyncDataStatus/);
  assert.match(appJs, /runBackgroundSync\(syncAction, collectionKey = ""\)/);
  assert.match(appJs, /scheduleSync\.pushSchedules\(schedulesSnapshot\), "schedules"\)/);
  assert.match(appJs, /scheduleSync\.pushReminders\(remindersSnapshot\), "reminders"\)/);
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
  assert.match(appJs, /function runBackgroundSync/);
  assert.match(appJs, /runBackgroundSync\(\(\) => scheduleSync\.pushDiaryEntries/);
});

test("background sync pushes are guarded from unhandled rejections", () => {
  assert.match(appJs, /Promise\.resolve\(syncAction\(\)\)/);
  assert.match(appJs, /result\?\.status === "offline"/);
  assert.match(appJs, /Синхронизация повторится при подключении/);
  assert.match(appJs, /\.catch\(\(\) =>/);
  assert.match(appJs, /runBackgroundSync\(\(\) => scheduleSync\.pushSchedules/);
  assert.match(appJs, /runBackgroundSync\(\(\) => scheduleSync\.pushTasks/);
  assert.match(appJs, /runBackgroundSync\(\(\) => scheduleSync\.pushNotes/);
  assert.match(appJs, /runBackgroundSync\(\(\) => scheduleSync\.pushBirthdays/);
  assert.match(appJs, /runBackgroundSync\(\(\) => scheduleSync\.pushDiaryEntries/);
  assert.match(appJs, /runBackgroundSync\(\(\) => scheduleSync\.pushReminders/);
});

test("sync account connection validates the remote code before switching local account", () => {
  assert.match(appJs, /scheduleSync\.checkAccountId\(accountId\)/);
  assert.match(appJs, /Проверяем код аккаунта/);
  assert.match(appJs, /Такой аккаунт не найден/);
  assert.match(appJs, /Не удалось проверить код/);
  assert.match(syncJs, /async checkAccountId\(accountId\)/);
  assert.match(syncJs, /status: "not-found"/);
});

test("online recovery sync is coalesced into one pass", () => {
  assert.match(appJs, /let pendingOnlineRecoverySync = null/);
  assert.match(appJs, /function runOnlineRecoverySync/);
  assert.match(appJs, /if \(pendingOnlineRecoverySync\) return pendingOnlineRecoverySync/);
  assert.match(appJs, /pendingOnlineRecoverySync = Promise\.allSettled\(\[/);
  assert.match(appJs, /syncSavedSchedules\(\)/);
  assert.match(appJs, /syncSavedReminders\(\)/);
  assert.match(appJs, /registerServerPushSubscription\(\)/);
  assert.match(appJs, /refreshReminderPushStatus\(\)/);
  assert.match(appJs, /pendingOnlineRecoverySync = null/);
  assert.match(appJs, /window\.addEventListener\("online", \(\) => {\s+runOnlineRecoverySync\(\);/);
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
  assert.match(appJs, /function clearDiaryPinFromLocalStorage/);
  assert.match(appJs, /const legacyDiaryPinSettings = getDiaryPinFromLocalStorage\(\)/);
  assert.match(appJs, /await scheduleStorage\.saveDiaryPinSettings\(legacyDiaryPinSettings\)/);
  assert.match(appJs, /await scheduleStorage\.saveDiaryPinSettings\(normalizedSettings\);\s+clearDiaryPinFromLocalStorage\(\);/);
});
