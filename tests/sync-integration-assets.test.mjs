import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const appJs = readFileSync("public/js/app.js", "utf8");
const appCss = readFileSync("public/css/app.css", "utf8");
const syncJs = readFileSync("public/js/sync.js", "utf8");
const serverJs = readFileSync("server/sync-server.mjs", "utf8");
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
  assert.match(serviceWorker, /focus-pwa-v118/);
  assert.match(serviceWorker, /"\/subscription\.html"/);
  assert.match(serviceWorker, /"\/offer\.html"/);
  assert.match(serviceWorker, /"\/privacy\.html"/);
  assert.match(serviceWorker, /"\/requisites\.html"/);
  assert.match(serviceWorker, /"\/js\/auth\.js"/);
  assert.match(serviceWorker, /"\/js\/sync\.js"/);
  assert.match(serviceWorker, /"\/js\/holiday-catalog\.js"/);
  assert.match(serviceWorker, /"\/js\/notifications\.js"/);
  assert.match(serviceWorker, /addEventListener\("push"/);
});

test("app shell exposes daily quotes sync and preferences UI", () => {
  assert.match(indexHtml, /id="quotesModal"/);
  assert.match(indexHtml, /id="quotesRefreshButton"/);
  assert.match(indexHtml, /id="quotePreferencesSaveButton"/);
  assert.match(indexHtml, /id="quoteCategoryOptions"/);
  assert.match(appJs, /async function loadDailyQuotes/);
  assert.match(appJs, /async function loadQuotePreferencesUi/);
  assert.match(appJs, /function syncQuotePreferenceControls/);
  assert.match(appJs, /function toggleQuoteFavorite/);
  assert.match(syncJs, /async getQuoteCategories\(\)/);
  assert.match(syncJs, /async getTodayQuotes/);
  assert.match(syncJs, /async getQuotePreferences/);
  assert.match(syncJs, /async updateQuotePreferences/);
  assert.match(syncJs, /async favoriteQuote/);
  assert.match(syncJs, /async unfavoriteQuote/);
  assert.match(serverJs, /\/api\/quotes\/categories/);
  assert.match(serverJs, /\/api\/quotes\/today/);
  assert.match(serverJs, /\/api\/quotes\/preferences/);
});

test("app shell exposes holiday catalog settings and readonly event details", () => {
  assert.match(indexHtml, /data-open-modal="holidays"/);
  assert.match(indexHtml, /id="holidaysModal"/);
  assert.match(indexHtml, /id="holidaySettingsSaveButton"/);
  assert.match(indexHtml, /id="holidayReligiousOptions"/);
  assert.match(indexHtml, /id="holidayProfessionalCategories"/);
  assert.match(indexHtml, /id="holidayEventModal"/);
  assert.match(appCss, /\.holiday-settings-panel\s*{/);
  assert.match(appCss, /\.holiday-detail-card\s*{/);
  assert.match(appJs, /holidays:\s*document\.querySelector\("#holidaysModal"\)/);
  assert.match(appJs, /holidayEvent:\s*document\.querySelector\("#holidayEventModal"\)/);
  assert.match(appJs, /hydrateHolidayCalendar\(\)/);
  assert.match(appJs, /data-open-holiday-event/);
  assert.match(appJs, /scheduleStorage\.loadHolidayReligiousPreferences/);
  assert.match(appJs, /scheduleStorage\.saveHolidayReligiousPreferences/);
  assert.match(syncJs, /async getPublishedHolidayCatalog/);
  assert.match(syncJs, /async getHolidayPreferences/);
  assert.match(syncJs, /async updateHolidayPreferences/);
  assert.match(serverJs, /\/api\/holiday-calendars\/published/);
  assert.match(serverJs, /\/api\/holiday-preferences/);
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

test("sync client exposes paid feature entitlements", () => {
  assert.match(syncJs, /async getAccountEntitlements\(\)/);
  assert.match(syncJs, /async getEntitlementEvents\(\)/);
  assert.match(syncJs, /async getTranscriptionStatus\(\)/);
  assert.match(syncJs, /async getTranscriptionEvents\(\)/);
  assert.match(syncJs, /async transcribeAudio\(\{ audioBase64, mimeType, durationMs = 0, language = "ru-RU", prompt = "" \} = \{\}\)/);
  assert.match(syncJs, /async createSubscriptionCheckout\(\{ featureKey \} = \{\}\)/);
  assert.match(syncJs, /async getSubscriptionCheckoutStatus\(\{ paymentId \} = \{\}\)/);
  assert.match(syncJs, /getPendingSubscriptionCheckout\(\)/);
  assert.match(syncJs, /focus-sync-pending-subscription-checkout/);
  assert.match(syncJs, /expiresAt/);
  assert.match(syncJs, /paymentId/);
  assert.match(syncJs, /\/sync\/entitlements/);
  assert.match(syncJs, /\/sync\/entitlements\/events/);
  assert.match(syncJs, /\/sync\/transcription\/status/);
  assert.match(syncJs, /\/sync\/transcription\/events/);
  assert.match(syncJs, /\/sync\/transcription/);
  assert.match(syncJs, /MAX_TRANSCRIPTION_AUDIO_BASE64_LENGTH/);
  assert.match(syncJs, /MAX_TRANSCRIPTION_DURATION_MS/);
  assert.match(syncJs, /\/sync\/checkout/);
  assert.match(syncJs, /\/sync\/checkout\/status\?paymentId=/);
  assert.match(syncJs, /voiceTranscription/);
  assert.match(syncJs, /provider-not-configured/);
});

test("settings and useful hub expose paid feature access status", () => {
  assert.match(indexHtml, /id="paidFeaturesSummary"/);
  assert.match(indexHtml, /id="paidFeaturesList"/);
  assert.match(indexHtml, /id="paidFeaturesRefreshButton"/);
  assert.match(indexHtml, /id="paidFeatureEventsPanel"/);
  assert.match(indexHtml, /id="paidFeatureEventsSummary"/);
  assert.match(indexHtml, /id="paidFeatureEventsList"/);
  assert.match(indexHtml, /id="transcriptionEventsPanel"/);
  assert.match(indexHtml, /id="transcriptionEventsSummary"/);
  assert.match(indexHtml, /id="transcriptionEventsList"/);
  assert.match(indexHtml, /id="usefulSubscriptionPanel"/);
  assert.match(appCss, /\.paid-features-panel\s*{/);
  assert.match(appCss, /\.paid-feature-card\s*{/);
  assert.match(appCss, /\.paid-feature-usage\s*{/);
  assert.match(appCss, /\.paid-feature-usage__bar\s*{/);
  assert.match(appCss, /\.paid-feature-events\s*{/);
  assert.match(appCss, /\.paid-feature-event\s*{/);
  assert.match(appCss, /\.paid-feature-event__status--ok\s*{/);
  assert.match(appCss, /\.paid-feature-event__status--warn\s*{/);
  assert.match(appCss, /\.secondary-link\s*{/);
  assert.match(appCss, /\.paid-feature-status--ok\s*{/);
  assert.match(appCss, /\.useful-subscription-panel\s*{/);
  assert.match(appCss, /\.useful-subscription-panel__readiness\s*{/);
  assert.match(appJs, /const paidFeatureItems = \[/);
  assert.match(appJs, /key:\s*"voiceTranscription"/);
  assert.match(appJs, /priceLabel:\s*"Focus Plus · 199 ₽\/мес"/);
  assert.match(appJs, /subscriptionUrl:\s*"\/subscription\.html"/);
  assert.match(appJs, /Условия и цена/);
  assert.match(appJs, /function renderPaidFeatureSurfaces/);
  assert.match(appJs, /function renderUsefulTranscriptionReadiness/);
  assert.match(appJs, /function getPaidFeaturePendingCheckout/);
  assert.match(appJs, /function getSafeCheckoutUrl/);
  assert.match(appJs, /function renderPaidFeatureCheckoutContinuation/);
  assert.match(appJs, /function renderPaidFeatureCheckoutReset/);
  assert.match(appJs, /data-paid-feature-reset="\$\{escapeHtml\(featureKey\)\}"/);
  assert.match(appJs, /function resetPendingSubscriptionCheckout/);
  assert.match(appJs, /scheduleSync\.clearPendingSubscriptionCheckout\?\.\(\)/);
  assert.match(appJs, /"useful"/);
  assert.match(appJs, /const initialLaunchTarget = getInitialLaunchTarget\(\)/);
  assert.match(appJs, /const shouldShowInitialPendingCheckoutStatus = initialLaunchTarget === "useful" && Boolean\(scheduleSync\.getPendingSubscriptionCheckout\?\.\(\)\)/);
  assert.match(appJs, /bindControls\(initialLaunchTarget\)/);
  assert.match(appJs, /checkPendingSubscriptionCheckout\(\{ silent: !shouldShowInitialPendingCheckoutStatus \}\)/);
  assert.match(appJs, /function renderPaidFeatureUsageDiagnostics/);
  assert.match(appJs, /getPaidFeatureUsageText\(featureKey\)/);
  assert.match(appJs, /Использовано \$\{usage\.used\} из \$\{usage\.limit\}/);
  assert.match(appJs, /async function refreshAccountEntitlements/);
  assert.match(appJs, /function renderEntitlementEventsPanel/);
  assert.match(appJs, /async function refreshEntitlementEvents/);
  assert.match(appJs, /function getEntitlementEventStatus/);
  assert.match(appJs, /accountTranscriptionStatusState/);
  assert.match(appJs, /providerModel/);
  assert.match(appJs, /providerTimeoutMs/);
  assert.match(appJs, /function normalizeTranscriptionStatus/);
  assert.match(appJs, /function renderTranscriptionEventsPanel/);
  assert.match(appJs, /async function refreshTranscriptionEvents/);
  assert.match(appJs, /function getTranscriptionReadinessSummary/);
  assert.match(appJs, /function getTranscriptionEventStatus/);
  assert.match(appJs, /function normalizeTranscriptionEvents/);
  assert.match(appJs, /processingMs/);
  assert.match(appJs, /обработка: \$\{processingText\}/);
  assert.match(appJs, /function formatTranscriptionDuration/);
  assert.match(appJs, /STT-провайдер готов/);
  assert.match(appJs, /provider_auth_failed/);
  assert.match(appJs, /provider_rejected_audio/);
  assert.match(appJs, /async function startPaidFeatureCheckout/);
  assert.match(appJs, /async function checkPendingSubscriptionCheckout/);
  assert.match(appJs, /Действует до/);
  assert.match(appJs, /Истёк/);
  assert.match(appJs, /scheduleSync\.getAccountEntitlements\(\)/);
  assert.match(appJs, /usage: result\.usage \|\| createDefaultAccountFeatureUsage\(\)/);
  assert.match(appJs, /scheduleSync\.getEntitlementEvents\(\)/);
  assert.match(appJs, /scheduleSync\.getTranscriptionStatus\(\)/);
  assert.match(appJs, /scheduleSync\.getTranscriptionEvents\(\)/);
  assert.match(appJs, /renderUsefulSubscriptionPanel\(\);[\s\S]*?scheduleSync\.getTranscriptionStatus\(\)/);
  assert.match(appJs, /scheduleSync\.getTranscriptionEvents\(\)[\s\S]*?renderUsefulSubscriptionPanel\(\);/);
  assert.match(appJs, /scheduleSync\.createSubscriptionCheckout\(\{ featureKey: feature\.key \}\)/);
  assert.match(appJs, /scheduleSync\.getSubscriptionCheckoutStatus\(\{ paymentId: pendingCheckout\.paymentId \}\)/);
  assert.match(appJs, /checkPendingSubscriptionCheckout\(\{ silent: true \}\)/);
  assert.match(appJs, /checkPendingSubscriptionCheckout\(\{ silent: false \}\)/);
  assert.match(appJs, /status:\s*"checking"/);
  assert.match(appJs, /status:\s*"pending"/);
  assert.match(appJs, /getPaidFeaturePendingCheckout\(featureKey\)/);
  assert.match(appJs, /renderPaidFeatureCheckoutContinuation\(feature\.key, true\)/);
  assert.match(appJs, /renderPaidFeatureCheckoutContinuation\(feature\.key\)/);
  assert.match(appJs, /Продолжить оплату/);
  assert.match(appJs, /\["https:", "http:"\]\.includes\(parsedUrl\.protocol\)/);
  assert.match(appJs, /window\.location\.assign\(result\.checkoutUrl\)/);
  assert.match(appJs, /data-paid-feature-action="\$\{escapeHtml\(feature\.key\)\}"/);
  assert.match(appJs, /document\.querySelector\("#paidFeaturesRefreshButton"\)\?\.addEventListener\("click"/);
  assert.match(syncJs, /usage: normalizeAccountFeatureUsage\(result\.usage\)/);
  assert.match(syncJs, /providerTimeoutMs/);
  assert.match(serverJs, /\/api\/sync\/transcription\/status/);
  assert.match(serverJs, /providerConfigured/);
  assert.match(serverJs, /providerModel/);
  assert.match(serverJs, /providerTimeoutMs/);
  assert.match(serverJs, /processingMs/);
  assert.match(serverJs, /MAX_TRANSCRIPTION_PROCESSING_MS/);
  assert.match(serverJs, /usage: \{[\s\S]*?voiceTranscription: db\.getFeatureUsage\(\{/);
  assert.match(serverJs, /DEFAULT_OPENAI_TRANSCRIPTION_MODEL = "gpt-transcribe"/);
  assert.match(serverJs, /DEFAULT_OPENAI_TRANSCRIPTION_URL = "https:\/\/api\.openai\.com\/v1\/audio\/transcriptions"/);
  assert.match(serverJs, /DEFAULT_OPENAI_TRANSCRIPTION_TIMEOUT_MS/);
  assert.match(serverJs, /FOCUS_OPENAI_TRANSCRIPTION_TIMEOUT_MS/);
  assert.match(serverJs, /function transcribeWithOpenAIProvider/);
  assert.match(serverJs, /FOCUS_OPENAI_API_KEY/);
  assert.match(serverJs, /provider_auth_failed/);
  assert.match(serverJs, /provider_timeout/);
});

test("voice input buttons are gated by the paid transcription entitlement", () => {
  assert.match(indexHtml, /data-voice-target="#reminderText"/);
  assert.match(indexHtml, /data-voice-target="#taskText"/);
  assert.match(indexHtml, /data-voice-target="#noteText"/);
  assert.match(indexHtml, /data-voice-target="#birthdayNote"/);
  assert.match(indexHtml, /data-voice-target="#diaryText"/);
  assert.match(indexHtml, /data-voice-target="#scheduleModal \.schedule-step:not\(\[hidden\]\) textarea, #scheduleModal \.schedule-step:not\(\[hidden\]\) input\[type='text'\]"/);
  assert.match(appCss, /\.voice-button--active\s*{/);
  assert.match(appCss, /\.voice-button--recording\s*{/);
  assert.match(appCss, /\.voice-status\s*{/);
  assert.match(appCss, /\.voice-button\[disabled\]\s*{/);
  assert.match(appJs, /const VOICE_RECORDING_MAX_MS = 15000/);
  assert.match(appJs, /function getSpeechRecognitionConstructor\(\)/);
  assert.match(appJs, /window\.SpeechRecognition \|\| window\.webkitSpeechRecognition/);
  assert.match(appJs, /function getMediaRecorderConstructor\(\)/);
  assert.match(appJs, /navigator\.mediaDevices\?\.getUserMedia/);
  assert.match(appJs, /function formatVoiceRecordingLimit\(\)/);
  assert.match(appJs, /activeVoiceRecorderStoppedByLimit/);
  assert.match(appJs, /Запись достигла лимита/);
  assert.match(appJs, /function getVoiceMicrophoneFailureMessage\(error\)/);
  assert.match(appJs, /NotAllowedError/);
  assert.match(appJs, /NotFoundError/);
  assert.match(appJs, /NotReadableError/);
  assert.match(appJs, /function getSpeechRecognitionFailureMessage\(error\)/);
  assert.match(appJs, /no-speech/);
  assert.match(appJs, /audio-capture/);
  assert.match(appJs, /function renderVoiceInputControls\(\)/);
  assert.match(appJs, /function startVoiceInput\(button\)/);
  assert.match(appJs, /async function startVoiceRecording\(button\)/);
  assert.match(appJs, /activeVoiceRecorderStartedAt/);
  assert.match(appJs, /submitVoiceRecording\(button, target, chunks, recordedMimeType, durationMs, stoppedByLimit\)/);
  assert.match(appJs, /function blobToBase64\(blob\)/);
  assert.match(appJs, /scheduleSync\.transcribeAudio\(\{/);
  assert.match(appJs, /durationMs,/);
  assert.match(appJs, /function getVoiceTranscriptionProviderFailureMessage\(reason\)/);
  assert.match(appJs, /provider_timeout/);
  assert.match(appJs, /getVoiceTranscriptionFailureMessage\(result\.status, result\.reason\)/);
  assert.match(appJs, /provider-not-configured/);
  assert.match(appJs, /usage-limit-exceeded/);
  assert.match(appJs, /Месячный лимит транскрибации исчерпан/);
  assert.match(appJs, /function insertVoiceTranscript\(target, transcript\)/);
  assert.match(appJs, /handlePaidFeatureAction\("voiceTranscription", openModal\)/);
  assert.match(appJs, /recognition\.lang = "ru-RU"/);
  assert.match(syncJs, /usage_limit_exceeded/);
  assert.match(syncJs, /normalizeTranscriptionFailureReason\(result\.reason\)/);
  assert.match(syncJs, /normalizeTranscriptionUsage\(result\.usage\)/);
  assert.match(serverJs, /FOCUS_VOICE_TRANSCRIPTION_MONTHLY_LIMIT/);
  assert.match(serverJs, /db\.getFeatureUsage\(\{/);
});

test("orbit logout cleans up current sync device and local push subscription", () => {
  assert.match(appJs, /async function logoutAuthSession/);
  assert.match(appJs, /scheduleSync\.peekAccountId\(\)\.startsWith\("orbit:"\)/);
  assert.match(appJs, /await scheduleSync\.disconnectCurrentDevice\(\)/);
  assert.match(appJs, /await focusNotifications\.unsubscribePush\?\.\(\)/);
  assert.match(appJs, /scheduleSync\.clearAccountId\(\)/);
  assert.match(appJs, /resetSyncCollectionStates\(\)/);
});

test("sync account switch cleans up previous device before saving the next account", () => {
  assert.match(appJs, /async function connectSyncAccount/);
  assert.match(appJs, /async function cleanupCurrentSyncDeviceBeforeAccountChange\(nextAccountId\)/);
  assert.match(appJs, /const nextAccountId = accountCheck\.accountId \|\| accountId/);
  assert.match(appJs, /const previousAccountId = scheduleSync\.peekAccountId\(\)/);
  assert.match(appJs, /if \(!previousAccountId \|\| previousAccountId === nextAccountId\) \{[\s\S]*?return false;[\s\S]*?\}/);
  assert.match(appJs, /await scheduleSync\.disconnectCurrentDevice\(\);[\s\S]*?await focusNotifications\.unsubscribePush\?\.\(\);/);
  assert.match(appJs, /return true;/);
  assert.match(appJs, /const accountChanged = await cleanupCurrentSyncDeviceBeforeAccountChange\(nextAccountId\);[\s\S]*?scheduleSync\.setAccountId\(nextAccountId\)/);
});

test("orbit auth session switch cleans up previous device before saving the orbit account", () => {
  assert.match(appJs, /async function refreshAuthSession/);
  assert.match(appJs, /authSession\.authenticated && authSession\.accountId && scheduleSync\.peekAccountId\(\) !== authSession\.accountId/);
  assert.match(appJs, /const accountChanged = await cleanupCurrentSyncDeviceBeforeAccountChange\(authSession\.accountId\);[\s\S]*?scheduleSync\.setAccountId\(authSession\.accountId\)/);
});

test("sync account switching clears stale collection diagnostics", () => {
  assert.match(appJs, /if \(accountChanged\) \{[\s\S]*?resetSyncCollectionStates\(\);[\s\S]*?\}/);
  assert.match(appJs, /const accountChanged = await cleanupCurrentSyncDeviceBeforeAccountChange\(authSession\.accountId\);[\s\S]*?if \(accountChanged\) \{[\s\S]*?resetSyncCollectionStates\(\);[\s\S]*?\}/);
  assert.match(appJs, /const accountChanged = await cleanupCurrentSyncDeviceBeforeAccountChange\(nextAccountId\);[\s\S]*?if \(accountChanged\) \{[\s\S]*?resetSyncCollectionStates\(\);[\s\S]*?\}/);
});

test("manual sync account switch clears stale account profile before refreshing the new one", () => {
  assert.match(appJs, /const accountChanged = await cleanupCurrentSyncDeviceBeforeAccountChange\(nextAccountId\);[\s\S]*?scheduleSync\.setAccountId\(nextAccountId\);[\s\S]*?if \(accountChanged\) \{[\s\S]*?syncAccountProfile = null;[\s\S]*?resetSyncCollectionStates\(\);[\s\S]*?renderSyncAccountProfile\(\);[\s\S]*?\}/);
  assert.match(appJs, /renderSyncState\(\);[\s\S]*?await refreshSyncAccountProfile\(\);/);
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
  assert.match(appJs, /focusNotifications\.unsubscribePush\?\.\(\)/);
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

test("app guards legacy localStorage fallback reads", () => {
  assert.match(appJs, /function readLocalStorageItem\(key\)/);
  assert.match(appJs, /function readLegacyScheduleList\(key\)/);
  assert.match(appJs, /JSON\.parse\(readLocalStorageItem\(DIARY_PIN_KEY\) \|\| "null"\)/);
  assert.match(appJs, /localReminders = readLegacyScheduleList\(REMINDERS_KEY\)/);
  assert.doesNotMatch(appJs, /parseScheduleList\(localStorage\.getItem/);
});

test("app menu exposes the useful services hub", () => {
  assert.match(indexHtml, /data-open-modal="useful"/);
  assert.match(indexHtml, /id="usefulModal"/);
  assert.match(indexHtml, /id="personalScheduleFeature"/);
  assert.match(indexHtml, /Идеальное расписание/);
  assert.match(indexHtml, /id="personalScheduleModal"/);
  assert.match(appJs, /useful:\s*document\.querySelector\("#usefulModal"\)/);
  assert.match(appJs, /personalSchedule:\s*document\.querySelector\("#personalScheduleModal"\)/);
  assert.match(appJs, /createPersonalSchedulePlannerUi/);
  assert.match(serviceWorker, /"\/js\/personal-schedule-planner\.js"/);
  assert.match(serviceWorker, /"\/js\/personal-schedule-ui\.js"/);
});

test("reminder modal exposes local notification controls", () => {
  assert.match(appJs, /createFocusNotifications\(\)/);
  assert.match(appJs, /saveLocalReminder/);
  assert.match(appJs, /syncSavedReminders/);
  assert.match(appJs, /scheduleStorage\.migrateRemindersFromLocalStorage/);
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
  assert.match(appJs, /flushPendingSyncDeviceDisconnects\(\)/);
  assert.match(appJs, /flushPendingSyncAccountProfileUpdate\(\)/);
  assert.match(appJs, /scheduleSync\.flushPendingAccountProfileUpdate\(\)/);
  assert.match(appJs, /scheduleSync\.flushPendingDeviceDisconnects\(\)/);
  assert.match(appJs, /registerServerPushSubscription\(\)/);
  assert.match(appJs, /refreshReminderPushStatus\(\)/);
  assert.match(appJs, /pendingOnlineRecoverySync = null/);
  assert.match(appJs, /window\.addEventListener\("online", \(\) => {\s+runOnlineRecoverySync\(\);/);
  assert.match(appJs, /flushPendingSyncDeviceDisconnects\(\);/);
  assert.match(appJs, /flushPendingSyncAccountProfileUpdate\(\);/);
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
