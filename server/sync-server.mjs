import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import http from "node:http";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import webPush from "web-push";
import {
  getHolidayCatalogVersion,
  getProfessionalHolidayCategories,
  getPublishedHolidayCatalog,
  normalizeHolidayPreferences,
  validateHolidayPreferences,
} from "../public/js/holiday-catalog.js";

const DEFAULT_PORT = Number(process.env.FOCUS_SYNC_PORT || 4178);
const DEFAULT_DB_PATH = process.env.FOCUS_SYNC_DB || join(process.cwd(), "data", "focus-sync.json");
const DEFAULT_PUSH_INTERVAL_MS = Number(process.env.FOCUS_PUSH_INTERVAL_MS || 30000);
const DEFAULT_PUSH_TTL_SECONDS = Number(process.env.FOCUS_PUSH_TTL_SECONDS || 86400);
const DEFAULT_PUSH_MAX_AGE_MS = Number(process.env.FOCUS_PUSH_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000);
const DEFAULT_PUSH_RETRY_DELAY_MS = readNonNegativeNumberEnv("FOCUS_PUSH_RETRY_DELAY_MS", 5 * 60 * 1000);
const DEFAULT_PUSH_RETRY_MAX_ATTEMPTS = readPositiveIntegerEnv("FOCUS_PUSH_RETRY_MAX_ATTEMPTS", 3);
const DEFAULT_FOCUS_PLUS_AMOUNT_RUB = normalizeMoneyAmount(process.env.FOCUS_PLUS_AMOUNT_RUB || "199.00");
const DEFAULT_FOCUS_PLUS_PERIOD_DAYS = readPositiveIntegerEnv("FOCUS_PLUS_PERIOD_DAYS", 30);
const DEFAULT_YOOKASSA_PAYMENTS_URL = normalizeUrl(process.env.FOCUS_YOOKASSA_PAYMENTS_URL || "https://api.yookassa.ru/v3/payments");
const DEFAULT_VOICE_TRANSCRIPTION_MONTHLY_LIMIT = readPositiveIntegerEnv("FOCUS_VOICE_TRANSCRIPTION_MONTHLY_LIMIT", 300);
const MAX_TRANSCRIPTION_DURATION_MS = readPositiveIntegerEnv("FOCUS_VOICE_TRANSCRIPTION_MAX_DURATION_MS", 60 * 1000);
const DEFAULT_OPENAI_TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions";
const DEFAULT_OPENAI_TRANSCRIPTION_MODEL = "gpt-transcribe";
const DEFAULT_OPENAI_TRANSCRIPTION_TIMEOUT_MS = readPositiveIntegerEnv("FOCUS_OPENAI_TRANSCRIPTION_TIMEOUT_MS", 30000);
const MAX_TRANSCRIPTION_PROCESSING_MS = 120000;
const MAX_BODY_BYTES = 1024 * 1024;
const AUTH_SESSION_COOKIE = "focus_auth_session";
const AUTH_TRANSIENT_COOKIE = "focus_auth_pkce";
const AUTH_TRANSIENT_MAX_AGE_SECONDS = 10 * 60;
const AUTH_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_AUTH_ISSUER = "https://auth.dmnao83.ru";
const DEFAULT_AUTH_SCOPE = "openid email profile offline_access";
const MAX_DEVICE_SESSIONS_PER_ACCOUNT = 12;
const MAX_PUSH_ENDPOINT_LENGTH = 4096;
const MAX_PUSH_KEY_LENGTH = 512;
const ENTITLEMENT_SOURCE_PATTERN = /^[a-zA-Z0-9_.:-]{1,80}$/;
const YOOKASSA_PAYMENT_ID_PATTERN = /^[a-zA-Z0-9_.:-]{8,160}$/;
const PROVIDER_EVENT_PART_PATTERN = /^[a-zA-Z0-9_.:-]{1,120}$/;
const PROVIDER_EVENT_KEY_PATTERN = /^[a-zA-Z0-9_.:-]{1,420}$/;
const MAX_PROCESSED_PROVIDER_EVENTS = 500;
const VOICE_TRANSCRIPTION_FEATURE_KEY = "voiceTranscription";
const PAID_FEATURE_KEYS = new Set([VOICE_TRANSCRIPTION_FEATURE_KEY]);
const QUOTES_PER_DAY = 5;
const QUOTE_REPEAT_WINDOWS_DAYS = [90, 60, 30, 0];
const QUOTE_DEFAULT_TIMEZONE = "UTC";
const QUOTE_LANGUAGE = "ru";
const QUOTE_SELECTION_MODES = new Set(["any", "selected_categories"]);
const QUOTE_VERIFICATION_STATUS = "verified";
const QUOTE_RIGHTS_BLOCKED_STATUS = "review_required";
const QUOTE_FALLBACK_REASON = "recovery_fallback";
const QUOTE_SCHEDULED_REASON = "scheduled_midnight";
const QUOTE_CATEGORY_ANY_CODE = "any";
const QUOTE_CONTENT_VALIDATION_PASSED = "passed";
const QUOTE_CONTENT_VALIDATION_FAILED = "failed";
const QUOTE_REJECTION_PROFANITY_DETECTED = "profanity_detected";
const QUOTE_PROFANITY_NOT_DETECTED = "profanity_not_detected";
const PROFANITY_VALIDATION_INVALID_RULE_ID = "profanity-validation-invalid";
const DEFAULT_QUOTE_PROFANITY_RULES = normalizeQuoteProfanityRules([
  {
    id: "ru-profanity-core-001",
    terms: createCodePointTerms([
      [0x0445, 0x0443, 0x0439],
      [0x0445, 0x0443, 0x044f],
      [0x0445, 0x0443, 0x0435],
      [0x0445, 0x0443, 0x0438],
    ]),
  },
  {
    id: "ru-profanity-core-002",
    terms: createCodePointTerms([
      [0x043f, 0x0438, 0x0437, 0x0434],
    ]),
  },
  {
    id: "ru-profanity-core-003",
    terms: createCodePointTerms([
      [0x0431, 0x043b, 0x044f],
      [0x0431, 0x043b, 0x044f, 0x0434],
      [0x0431, 0x043b, 0x044f, 0x0442],
    ]),
  },
  {
    id: "ru-profanity-core-004",
    terms: createCodePointTerms([
      [0x0435, 0x0431, 0x0430, 0x0442],
      [0x0435, 0x0431, 0x0430, 0x043b],
      [0x0435, 0x0431, 0x0430, 0x043d],
      [0x0435, 0x0431, 0x0430, 0x0448],
      [0x0435, 0x0431, 0x0435, 0x0442],
      [0x0435, 0x0431, 0x0443, 0x0442],
      [0x0437, 0x0430, 0x0435, 0x0431],
      [0x043d, 0x0430, 0x0435, 0x0431],
      [0x043f, 0x043e, 0x0435, 0x0431],
      [0x0432, 0x044b, 0x0435, 0x0431],
      [0x0443, 0x0435, 0x0431],
      [0x043e, 0x0442, 0x044a, 0x0435, 0x0431],
      [0x0441, 0x044a, 0x0435, 0x0431],
      [0x0440, 0x0430, 0x0437, 0x044a, 0x0435, 0x0431],
      [0x043f, 0x043e, 0x0434, 0x044a, 0x0435, 0x0431],
    ]),
  },
  {
    id: "ru-profanity-core-005",
    terms: createCodePointTerms([
      [0x043c, 0x0430, 0x043d, 0x0434],
    ]),
  },
  {
    id: "ru-profanity-rude-001",
    terms: createCodePointTerms([
      [0x0436, 0x043e, 0x043f],
      [0x0433, 0x043e, 0x0432, 0x043d],
      [0x0441, 0x0440, 0x0430, 0x043d],
      [0x0441, 0x0440, 0x0430, 0x0442, 0x044c],
    ]),
  },
]);
const DEFAULT_QUOTE_CATEGORIES = [
  {
    id: "quote-category-life-wisdom",
    code: "life_wisdom",
    titleRu: "Жизнь и мудрость",
    descriptionRu: "Спокойные мысли о выборе, опыте и зрелости.",
    sortOrder: 10,
    isActive: true,
    minimumCatalogSize: 450,
  },
  {
    id: "quote-category-motivation",
    code: "motivation",
    titleRu: "Мотивация и вдохновение",
    descriptionRu: "Фразы для движения вперёд без давления и тревоги.",
    sortOrder: 20,
    isActive: true,
    minimumCatalogSize: 450,
  },
  {
    id: "quote-category-love-relationships",
    code: "love_relationships",
    titleRu: "Любовь и отношения",
    descriptionRu: "Цитаты о близости, уважении и внимании к другим.",
    sortOrder: 30,
    isActive: true,
    minimumCatalogSize: 450,
  },
  {
    id: "quote-category-family-children",
    code: "family_children",
    titleRu: "Семья и дети",
    descriptionRu: "Мысли о доме, семье, заботе и воспитании.",
    sortOrder: 40,
    isActive: true,
    minimumCatalogSize: 450,
  },
  {
    id: "quote-category-friendship-people",
    code: "friendship_people",
    titleRu: "Дружба и люди",
    descriptionRu: "Цитаты о человеческих связях, доверии и общении.",
    sortOrder: 50,
    isActive: true,
    minimumCatalogSize: 450,
  },
  {
    id: "quote-category-health-self-care",
    code: "health_self_care",
    titleRu: "Здоровье и забота о себе",
    descriptionRu: "Фразы о бережном отношении к себе и ресурсу.",
    sortOrder: 60,
    isActive: true,
    minimumCatalogSize: 450,
  },
  {
    id: "quote-category-work-vocation",
    code: "work_vocation",
    titleRu: "Работа и призвание",
    descriptionRu: "Цитаты о ремесле, ответственности и смысле труда.",
    sortOrder: 70,
    isActive: true,
    minimumCatalogSize: 450,
  },
  {
    id: "quote-category-business",
    code: "business",
    titleRu: "Бизнес и предпринимательство",
    descriptionRu: "Мысли о деле, решениях, риске и создании ценности.",
    sortOrder: 80,
    isActive: true,
    minimumCatalogSize: 450,
  },
  {
    id: "quote-category-goals-success",
    code: "goals_success",
    titleRu: "Цели и успех",
    descriptionRu: "Фразы о направлении, достижении и приоритетах.",
    sortOrder: 90,
    isActive: true,
    minimumCatalogSize: 450,
  },
  {
    id: "quote-category-self-development",
    code: "self_development",
    titleRu: "Саморазвитие и знания",
    descriptionRu: "Цитаты об обучении, внимании и личном росте.",
    sortOrder: 100,
    isActive: true,
    minimumCatalogSize: 450,
  },
  {
    id: "quote-category-calm-balance",
    code: "calm_balance",
    titleRu: "Спокойствие и внутреннее равновесие",
    descriptionRu: "Фразы о ясности, паузе и устойчивости.",
    sortOrder: 110,
    isActive: true,
    minimumCatalogSize: 450,
  },
  {
    id: "quote-category-creativity",
    code: "creativity",
    titleRu: "Творчество",
    descriptionRu: "Мысли о воображении, создании и поиске формы.",
    sortOrder: 120,
    isActive: true,
    minimumCatalogSize: 450,
  },
  {
    id: "quote-category-humor",
    code: "humor",
    titleRu: "Юмор и хорошее настроение",
    descriptionRu: "Лёгкие цитаты, которые не сбивают фокус.",
    sortOrder: 130,
    isActive: true,
    minimumCatalogSize: 450,
  },
  {
    id: "quote-category-time-productivity",
    code: "time_productivity",
    titleRu: "Время и продуктивность",
    descriptionRu: "Фразы о времени, выборе главного и действии.",
    sortOrder: 140,
    isActive: true,
    minimumCatalogSize: 450,
  },
];
const MAX_TRANSCRIPTION_AUDIO_BASE64_LENGTH = 768 * 1024;
const MAX_TRANSCRIPTION_TEXT_LENGTH = 5000;
const TRANSCRIPTION_MIME_TYPES = new Set([
  "audio/aac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
  "audio/x-wav",
]);

export function createSyncDatabase(dbPath = DEFAULT_DB_PATH, options = {}) {
  return new JsonSyncDatabase(dbPath, options);
}

class JsonSyncDatabase {
  constructor(dbPath, { profanityRules = DEFAULT_QUOTE_PROFANITY_RULES } = {}) {
    this.dbPath = dbPath;
    this.memoryOnly = dbPath === ":memory:";
    this.profanityRules = normalizeQuoteProfanityRules(profanityRules);
    this.state = this.memoryOnly ? createEmptyState() : readState(dbPath, { profanityRules: this.profanityRules });
    this.quoteCatalogNormalized = true;
  }

  createAccount({ accountId, displayName, createdAt }) {
    this.state.accounts[accountId] = {
      accountId,
      displayName: sanitizeStoredName(displayName),
      entitlements: createDefaultAccountEntitlements(),
      createdAt,
      updatedAt: createdAt,
    };
    this.persist();
  }

  getAccount(accountId) {
    return this.state.accounts[accountId] || null;
  }

  updateAccount({ accountId, displayName, updatedAt }) {
    const current = this.getAccount(accountId) || {
      accountId,
      displayName: null,
      entitlements: createDefaultAccountEntitlements(),
      createdAt: updatedAt,
      updatedAt,
    };

    this.state.accounts[accountId] = {
      ...current,
      displayName: sanitizeStoredName(displayName),
      entitlements: normalizeAccountEntitlements(current.entitlements),
      updatedAt,
    };
    this.persist();
    return this.state.accounts[accountId];
  }

  getAccountEntitlements(accountId, checkedAt = null) {
    return normalizeAccountEntitlements(this.getAccount(accountId)?.entitlements, null, checkedAt);
  }

  getFeatureUsage({ accountId, featureKey, checkedAt, limit = DEFAULT_VOICE_TRANSCRIPTION_MONTHLY_LIMIT }) {
    const normalizedFeatureKey = normalizePaidFeatureKey(featureKey);
    if (!this.getAccount(accountId) || !normalizedFeatureKey) {
      return null;
    }

    const usageRoot = isPlainObject(this.state.featureUsage) ? this.state.featureUsage : {};
    const accountUsage = isPlainObject(usageRoot[accountId]) ? usageRoot[accountId] : {};
    return normalizeFeatureUsageEntry({
      accountId,
      featureKey: normalizedFeatureKey,
      usage: accountUsage[normalizedFeatureKey],
      checkedAt,
      limit,
    });
  }

  recordFeatureUsage({ accountId, featureKey, checkedAt, count = 1, limit = DEFAULT_VOICE_TRANSCRIPTION_MONTHLY_LIMIT }) {
    const normalizedFeatureKey = normalizePaidFeatureKey(featureKey);
    if (!this.getAccount(accountId) || !normalizedFeatureKey) {
      return null;
    }

    if (!isPlainObject(this.state.featureUsage)) {
      this.state.featureUsage = {};
    }

    if (!isPlainObject(this.state.featureUsage[accountId])) {
      this.state.featureUsage[accountId] = {};
    }

    const currentUsage = normalizeFeatureUsageEntry({
      accountId,
      featureKey: normalizedFeatureKey,
      usage: this.state.featureUsage[accountId][normalizedFeatureKey],
      checkedAt,
      limit,
    });
    const nextUsed = currentUsage.used + normalizeUsageCount(count);
    this.state.featureUsage[accountId][normalizedFeatureKey] = {
      period: currentUsage.period,
      used: nextUsed,
      updatedAt: checkedAt,
    };
    this.persist();

    return normalizeFeatureUsageEntry({
      accountId,
      featureKey: normalizedFeatureKey,
      usage: this.state.featureUsage[accountId][normalizedFeatureKey],
      checkedAt,
      limit,
    });
  }

  setAccountEntitlements({ accountId, entitlements, updatedAt }) {
    const current = this.getAccount(accountId);
    if (!current) {
      return null;
    }

    this.state.accounts[accountId] = {
      ...current,
      entitlements: normalizeAccountEntitlements(entitlements, updatedAt),
      updatedAt,
    };
    this.persist();
    return this.getAccountEntitlements(accountId);
  }

  touchAccount({ accountId, deviceId, deviceName, now }) {
    if (!this.state.accounts[accountId]) {
      this.state.accounts[accountId] = {
        accountId,
        displayName: null,
        entitlements: createDefaultAccountEntitlements(),
        createdAt: now,
        updatedAt: now,
      };
    } else if (!this.state.accounts[accountId].updatedAt) {
      this.state.accounts[accountId].updatedAt = this.state.accounts[accountId].createdAt || now;
      this.state.accounts[accountId].entitlements = normalizeAccountEntitlements(this.state.accounts[accountId].entitlements);
    } else {
      this.state.accounts[accountId].entitlements = normalizeAccountEntitlements(this.state.accounts[accountId].entitlements);
    }

    const sessionKey = `${accountId}:${deviceId}`;
    const currentSession = this.state.deviceSessions[sessionKey];
    const normalizedDeviceName = sanitizeStoredName(deviceName);
    this.state.deviceSessions[`${accountId}:${deviceId}`] = {
      accountId,
      deviceId,
      deviceName: normalizedDeviceName || currentSession?.deviceName || null,
      firstSeenAt: currentSession?.firstSeenAt || currentSession?.lastSeenAt || now,
      lastSeenAt: now,
    };
    this.pruneDeviceSessions(accountId, deviceId);
    this.persist();
  }

  listDeviceSessions(accountId) {
    return Object.values(this.state.deviceSessions)
      .filter(session => isPlainObject(session) && session.accountId === accountId)
      .sort((first, second) => String(second.lastSeenAt || "").localeCompare(String(first.lastSeenAt || "")));
  }

  updateDeviceSession({ accountId, deviceId, deviceName, updatedAt }) {
    const sessionKey = `${accountId}:${deviceId}`;
    const currentSession = this.state.deviceSessions[sessionKey] || {
      accountId,
      deviceId,
      firstSeenAt: updatedAt,
    };

    this.state.deviceSessions[sessionKey] = {
      ...currentSession,
      deviceName: sanitizeStoredName(deviceName),
      lastSeenAt: updatedAt,
    };
    this.pruneDeviceSessions(accountId, deviceId);
    this.persist();
    return this.state.deviceSessions[sessionKey];
  }

  removeDeviceSession({ accountId, deviceId }) {
    const sessionKey = `${accountId}:${deviceId}`;
    const existed = Boolean(this.state.deviceSessions[sessionKey]);

    if (existed) {
      delete this.state.deviceSessions[sessionKey];
      this.persist();
    }

    return existed ? 1 : 0;
  }

  getScheduleSnapshot(accountId) {
    return this.state.scheduleSnapshots[accountId] || null;
  }

  saveScheduleSnapshot({ accountId, schedules, updatedAt }) {
    const current = this.getScheduleSnapshot(accountId);
    const snapshot = {
      accountId,
      revision: current ? current.revision + 1 : 1,
      schedules,
      updatedAt,
    };
    this.state.scheduleSnapshots[accountId] = snapshot;
    this.persist();
    return snapshot;
  }

  getReminderSnapshot(accountId) {
    return this.state.reminderSnapshots[accountId] || null;
  }

  saveReminderSnapshot({ accountId, reminders, updatedAt }) {
    const current = this.getReminderSnapshot(accountId);
    const snapshot = {
      accountId,
      revision: current ? current.revision + 1 : 1,
      reminders,
      updatedAt,
    };
    this.state.reminderSnapshots[accountId] = snapshot;
    this.pruneReminderPushState({ accountId, reminders });
    this.persist();
    return snapshot;
  }

  getTaskSnapshot(accountId) {
    return this.state.taskSnapshots[accountId] || null;
  }

  saveTaskSnapshot({ accountId, tasks, updatedAt }) {
    const current = this.getTaskSnapshot(accountId);
    const snapshot = {
      accountId,
      revision: current ? current.revision + 1 : 1,
      tasks,
      updatedAt,
    };
    this.state.taskSnapshots[accountId] = snapshot;
    this.persist();
    return snapshot;
  }

  getNoteSnapshot(accountId) {
    return this.state.noteSnapshots[accountId] || null;
  }

  saveNoteSnapshot({ accountId, notes, updatedAt }) {
    const current = this.getNoteSnapshot(accountId);
    const snapshot = {
      accountId,
      revision: current ? current.revision + 1 : 1,
      notes,
      updatedAt,
    };
    this.state.noteSnapshots[accountId] = snapshot;
    this.persist();
    return snapshot;
  }

  getBirthdaySnapshot(accountId) {
    return this.state.birthdaySnapshots[accountId] || null;
  }

  saveBirthdaySnapshot({ accountId, birthdays, updatedAt }) {
    const current = this.getBirthdaySnapshot(accountId);
    const snapshot = {
      accountId,
      revision: current ? current.revision + 1 : 1,
      birthdays,
      updatedAt,
    };
    this.state.birthdaySnapshots[accountId] = snapshot;
    this.persist();
    return snapshot;
  }

  getDiarySnapshot(accountId) {
    return this.state.diarySnapshots[accountId] || null;
  }

  saveDiarySnapshot({ accountId, entries, updatedAt }) {
    const current = this.getDiarySnapshot(accountId);
    const snapshot = {
      accountId,
      revision: current ? current.revision + 1 : 1,
      entries,
      updatedAt,
    };
    this.state.diarySnapshots[accountId] = snapshot;
    this.persist();
    return snapshot;
  }

  getQuoteCategories() {
    return normalizeQuoteCategories(this.state.quoteCategories);
  }

  replaceQuoteCatalog({ quotes, categories } = {}) {
    this.state.quoteCategories = normalizeQuoteCategories(categories || this.state.quoteCategories);
    this.state.quoteCatalog = normalizeQuoteCatalog(quotes, { profanityRules: this.profanityRules });
    this.quoteCatalogNormalized = true;
    this.persist();
    return {
      categories: this.getQuoteCategories(),
      quotes: this.getQuoteCatalog(),
    };
  }

  getQuoteCatalog() {
    return cloneQuoteCatalog(this.state.quoteCatalog);
  }

  auditQuoteCatalogForProduction({ checkedAt = new Date().toISOString() } = {}) {
    const before = this.quoteCatalogNormalized ? "" : JSON.stringify(this.state.quoteCatalog || []);
    if (!this.quoteCatalogNormalized) {
      this.state.quoteCatalog = normalizeQuoteCatalog(this.state.quoteCatalog, { profanityRules: this.profanityRules });
      this.quoteCatalogNormalized = true;
    }
    const report = createQuoteCatalogAuditReport(this.state.quoteCatalog, { checkedAt });
    if (before && JSON.stringify(this.state.quoteCatalog || []) !== before) {
      this.persist();
    }
    return report;
  }

  getUserQuotePreferences(accountId) {
    const preferences = this.state.userQuotePreferences[accountId];
    if (!preferences) {
      return null;
    }

    return normalizeUserQuotePreferences(preferences, {
      accountId,
      timezone: preferences.timezone || QUOTE_DEFAULT_TIMEZONE,
      checkedAt: preferences.updatedAt || new Date().toISOString(),
    });
  }

  saveUserQuotePreferences({ accountId, preferences, updatedAt }) {
    const normalizedPreferences = normalizeUserQuotePreferences(preferences, {
      accountId,
      timezone: preferences?.timezone || QUOTE_DEFAULT_TIMEZONE,
      checkedAt: updatedAt,
    });
    this.state.userQuotePreferences[accountId] = {
      ...normalizedPreferences,
      updatedAt,
    };
    this.persist();
    return this.state.userQuotePreferences[accountId];
  }

  getUserHolidayPreferences(accountId) {
    const preferences = this.state.userHolidayPreferences?.[accountId];
    return preferences ? normalizeHolidayPreferences(preferences) : null;
  }

  saveUserHolidayPreferences({ accountId, preferences, updatedAt }) {
    const normalizedPreferences = normalizeHolidayPreferences(preferences);
    this.state.userHolidayPreferences ||= {};
    this.state.userHolidayPreferences[accountId] = {
      ...normalizedPreferences,
      updatedAt,
    };
    this.persist();
    return this.state.userHolidayPreferences[accountId];
  }

  getDailyQuoteSet({ accountId, localDate }) {
    return this.state.dailyQuoteSets[createDailyQuoteSetKey(accountId, localDate)] || null;
  }

  getDailyQuoteSetItems(setId) {
    return Array.isArray(this.state.dailyQuoteSetItems[setId])
      ? this.state.dailyQuoteSetItems[setId]
      : [];
  }

  saveDailyQuoteSet({ set, items }) {
    const normalizedSet = normalizeDailyQuoteSet(set);
    const normalizedItems = normalizeDailyQuoteSetItems(items, normalizedSet.id);
    if (!normalizedSet || normalizedItems.length !== QUOTES_PER_DAY) {
      return null;
    }

    this.state.dailyQuoteSets[createDailyQuoteSetKey(normalizedSet.accountId, normalizedSet.localDate)] = normalizedSet;
    this.state.dailyQuoteSetItems[normalizedSet.id] = normalizedItems;
    this.persist();
    return {
      set: normalizedSet,
      items: normalizedItems,
    };
  }

  listRecentDailyQuoteItems({ accountId, beforeLocalDate, days = 90 }) {
    const beforeTime = Date.parse(`${beforeLocalDate}T00:00:00.000Z`);
    const cutoffTime = beforeTime - Math.max(0, Number(days) || 0) * 24 * 60 * 60 * 1000;
    if (!Number.isFinite(beforeTime)) {
      return [];
    }

    return Object.values(this.state.dailyQuoteSets)
      .filter(set => isPlainObject(set) && set.accountId === accountId)
      .filter(set => {
        const localTime = Date.parse(`${set.localDate}T00:00:00.000Z`);
        return Number.isFinite(localTime) && localTime < beforeTime && localTime >= cutoffTime;
      })
      .flatMap(set => this.getDailyQuoteSetItems(set.id));
  }

  isFavoriteQuote({ accountId, quoteId }) {
    return Boolean(this.state.favoriteQuotes[accountId]?.[quoteId]);
  }

  saveFavoriteQuote({ accountId, quoteId, createdAt }) {
    this.state.favoriteQuotes[accountId] ||= {};
    this.state.favoriteQuotes[accountId][quoteId] = {
      accountId,
      quoteId,
      createdAt,
    };
    this.persist();
    return this.state.favoriteQuotes[accountId][quoteId];
  }

  removeFavoriteQuote({ accountId, quoteId }) {
    const existed = Boolean(this.state.favoriteQuotes[accountId]?.[quoteId]);
    if (existed) {
      delete this.state.favoriteQuotes[accountId][quoteId];
      if (!Object.keys(this.state.favoriteQuotes[accountId]).length) {
        delete this.state.favoriteQuotes[accountId];
      }
      this.persist();
    }
    return existed;
  }

  saveQuoteEvent({
    accountId,
    eventType,
    quoteId,
    categoryCode,
    localDate,
    generationReason,
    createdAt,
  }) {
    if (!accountId) {
      return null;
    }

    const currentEvents = Array.isArray(this.state.quoteEvents[accountId])
      ? this.state.quoteEvents[accountId]
      : [];
    const event = {
      id: randomUUID(),
      accountId,
      eventType: sanitizeQuoteEventType(eventType),
      quoteId: sanitizeQuoteId(quoteId) || null,
      categoryCode: sanitizeQuoteCategoryCode(categoryCode) || null,
      localDate: normalizeLocalDate(localDate) || null,
      generationReason: sanitizeQuoteGenerationReason(generationReason),
      createdAt: normalizeTimestamp(createdAt),
    };
    this.state.quoteEvents[accountId] = [event, ...currentEvents].slice(0, 50);
    this.persist();
    return event;
  }

  getPushSubscriptions(accountId) {
    return Array.isArray(this.state.pushSubscriptions[accountId])
      ? this.state.pushSubscriptions[accountId]
      : [];
  }

  setPushSubscriptions(accountId, subscriptions) {
    if (subscriptions.length > 0) {
      this.state.pushSubscriptions[accountId] = subscriptions;
      return;
    }

    delete this.state.pushSubscriptions[accountId];
  }

  savePushSubscription({ accountId, deviceId, subscription, updatedAt }) {
    const subscriptions = this.getPushSubscriptions(accountId)
      .filter(item => item.deviceId !== deviceId && item.endpoint !== subscription.endpoint);
    const savedSubscription = {
      ...subscription,
      accountId,
      deviceId,
      updatedAt,
    };

    subscriptions.push(savedSubscription);
    this.setPushSubscriptions(accountId, subscriptions);
    this.persist();
    return savedSubscription;
  }

  removePushSubscription({ accountId, endpoint }) {
    const current = this.getPushSubscriptions(accountId);
    const subscriptions = current.filter(item => item.endpoint !== endpoint);
    const removed = current.length - subscriptions.length;

    if (removed > 0) {
      this.setPushSubscriptions(accountId, subscriptions);
      this.persist();
    }

    return removed;
  }

  removePushSubscriptionsForDevice({ accountId, deviceId }) {
    const current = this.getPushSubscriptions(accountId);
    const subscriptions = current.filter(item => item.deviceId !== deviceId);
    const removed = current.length - subscriptions.length;

    if (removed > 0) {
      this.setPushSubscriptions(accountId, subscriptions);
      this.persist();
    }

    return removed;
  }

  listPushEvents(accountId, limit = 8) {
    const events = Array.isArray(this.state.pushEvents[accountId])
      ? this.state.pushEvents[accountId]
      : [];

    return events.slice(0, Math.max(0, Number(limit) || 8));
  }

  listEntitlementEvents(accountId, limit = 12) {
    const events = Array.isArray(this.state.entitlementEvents[accountId])
      ? this.state.entitlementEvents[accountId]
      : [];

    return events.slice(0, Math.max(0, Number(limit) || 12));
  }

  listTranscriptionEvents(accountId, limit = 12) {
    const events = Array.isArray(this.state.transcriptionEvents[accountId])
      ? this.state.transcriptionEvents[accountId]
      : [];

    return events.slice(0, Math.max(0, Number(limit) || 12));
  }

  saveTranscriptionEvent({
    accountId,
    deviceId,
    status,
    provider,
    reason,
    mimeType,
    durationMs,
    processingMs,
    language,
    textLength,
    spent,
    usage,
    createdAt,
  }) {
    if (!accountId) {
      return null;
    }

    if (!isPlainObject(this.state.transcriptionEvents)) {
      this.state.transcriptionEvents = {};
    }

    const currentEvents = Array.isArray(this.state.transcriptionEvents[accountId])
      ? this.state.transcriptionEvents[accountId]
      : [];
    const event = {
      id: randomUUID(),
      accountId,
      deviceId: sanitizeStoredName(deviceId),
      status: sanitizeTranscriptionEventStatus(status),
      provider: sanitizeProviderEventPart(provider) || null,
      reason: sanitizeStoredName(reason),
      mimeType: normalizeTranscriptionMimeType(mimeType) || null,
      durationMs: normalizeTranscriptionEventDurationMs(durationMs),
      processingMs: normalizeTranscriptionEventProcessingMs(processingMs),
      language: normalizeTranscriptionLanguage(language),
      textLength: normalizeTranscriptionTextLength(textLength),
      spent: spent === true,
      usage: normalizeTranscriptionEventUsage(usage),
      createdAt: normalizeTimestamp(createdAt),
    };

    this.state.transcriptionEvents[accountId] = [event, ...currentEvents].slice(0, 50);
    this.persist();
    return event;
  }

  saveEntitlementEvent({
    accountId,
    featureKey,
    origin,
    status,
    source,
    paymentId,
    paymentStatus,
    paid,
    reason,
    expiresAt,
    createdAt,
  }) {
    if (!accountId) {
      return null;
    }

    const currentEvents = Array.isArray(this.state.entitlementEvents[accountId])
      ? this.state.entitlementEvents[accountId]
      : [];
    const event = {
      id: randomUUID(),
      accountId,
      featureKey: normalizePaidFeatureKey(featureKey) || null,
      origin: sanitizeEntitlementEventOrigin(origin),
      status: sanitizeEntitlementEventStatus(status),
      source: sanitizeEntitlementSource(source) || "none",
      paymentId: normalizeYooKassaPaymentId(paymentId) || null,
      paymentStatus: sanitizeStoredName(paymentStatus),
      paid: paid === true,
      reason: sanitizeStoredName(reason),
      expiresAt: normalizeTimestamp(expiresAt),
      createdAt: normalizeTimestamp(createdAt),
    };

    this.state.entitlementEvents[accountId] = [event, ...currentEvents].slice(0, 50);
    this.persist();
    return event;
  }

  getProcessedProviderEvent(eventKey) {
    const normalizedEventKey = normalizeProviderEventKey(eventKey);
    if (!normalizedEventKey || !isPlainObject(this.state.processedProviderEvents)) {
      return null;
    }

    const event = this.state.processedProviderEvents[normalizedEventKey];
    return isPlainObject(event) ? { ...event, eventKey: normalizedEventKey } : null;
  }

  saveProcessedProviderEvent({
    eventKey,
    provider,
    eventName,
    accountId,
    featureKey,
    paymentId,
    paymentStatus,
    paid,
    status,
    reason,
    createdAt,
  }) {
    const normalizedEventKey = normalizeProviderEventKey(eventKey);
    if (!normalizedEventKey) {
      return null;
    }

    if (!isPlainObject(this.state.processedProviderEvents)) {
      this.state.processedProviderEvents = {};
    }

    const existingEvent = this.getProcessedProviderEvent(normalizedEventKey);
    if (existingEvent) {
      return existingEvent;
    }

    const event = {
      eventKey: normalizedEventKey,
      provider: sanitizeProviderEventPart(provider) || "unknown",
      eventName: sanitizeProviderEventPart(eventName) || "unknown",
      accountId: sanitizeStoredName(accountId),
      featureKey: normalizePaidFeatureKey(featureKey) || null,
      paymentId: normalizeYooKassaPaymentId(paymentId) || null,
      paymentStatus: sanitizeStoredName(paymentStatus),
      paid: paid === true,
      status: sanitizeEntitlementEventStatus(status),
      reason: sanitizeStoredName(reason),
      createdAt: normalizeTimestamp(createdAt),
    };

    this.state.processedProviderEvents[normalizedEventKey] = event;
    this.pruneProcessedProviderEvents();
    this.persist();
    return event;
  }

  pruneProcessedProviderEvents(limit = MAX_PROCESSED_PROVIDER_EVENTS) {
    if (!isPlainObject(this.state.processedProviderEvents)) {
      this.state.processedProviderEvents = {};
      return;
    }

    const entries = Object.entries(this.state.processedProviderEvents)
      .filter(([, event]) => isPlainObject(event))
      .sort((firstEntry, secondEntry) => compareProcessedProviderEventsForRetention(firstEntry, secondEntry));

    if (entries.length <= limit) {
      return;
    }

    const retainedKeys = new Set(entries.slice(0, limit).map(([key]) => key));
    Object.keys(this.state.processedProviderEvents).forEach(key => {
      if (!retainedKeys.has(key)) {
        delete this.state.processedProviderEvents[key];
      }
    });
  }

  savePushEvent({ accountId, deviceId, type, status, title, reminderId, scheduledAt, sent, failed, removed, subscriptions, attempts, maxAttempts, nextRetryAt, createdAt }) {
    const currentEvents = Array.isArray(this.state.pushEvents[accountId])
      ? this.state.pushEvents[accountId]
      : [];
    const event = {
      id: randomUUID(),
      accountId,
      deviceId: sanitizeStoredName(deviceId),
      type: sanitizePushEventType(type),
      status: sanitizePushEventStatus(status),
      title: sanitizeStoredName(title),
      reminderId: sanitizeStoredName(reminderId),
      scheduledAt: typeof scheduledAt === "string" ? scheduledAt : null,
      sent: Number(sent) || 0,
      failed: Number(failed) || 0,
      removed: Number(removed) || 0,
      subscriptions: Number(subscriptions) || 0,
      attempts: Number(attempts) || 0,
      maxAttempts: Number(maxAttempts) || 0,
      nextRetryAt: typeof nextRetryAt === "string" ? nextRetryAt : null,
      createdAt,
    };
    const dedupedEvents = event.type === "reminder" && event.reminderId && event.scheduledAt
      ? currentEvents.filter(item => !(
        item.type === event.type &&
        item.status === event.status &&
        item.reminderId === event.reminderId &&
        item.scheduledAt === event.scheduledAt
      ))
      : currentEvents;

    this.state.pushEvents[accountId] = [event, ...dedupedEvents].slice(0, 30);
    this.persist();
    return event;
  }

  listReminderSnapshots() {
    return Object.values(this.state.reminderSnapshots).filter(isPlainObject);
  }

  hasPushDelivery(accountId, deliveryKey) {
    return Boolean(this.state.pushDeliveries[accountId]?.[deliveryKey]);
  }

  getPushDelivery(accountId, deliveryKey) {
    return this.state.pushDeliveries[accountId]?.[deliveryKey] || null;
  }

  savePushDelivery({ accountId, deliveryKey, reminderId, scheduledAt, sentAt, deliveryCount }) {
    this.state.pushDeliveries[accountId] ||= {};
    this.state.pushDeliveries[accountId][deliveryKey] = {
      accountId,
      deliveryKey,
      reminderId,
      scheduledAt,
      sentAt,
      deliveryCount,
    };
    deleteAccountStateKey(this.state.pushRetries, accountId, deliveryKey);
    deleteAccountStateKey(this.state.pushFailures, accountId, deliveryKey);
    this.persist();
  }

  getPushRetry(accountId, deliveryKey) {
    return this.state.pushRetries[accountId]?.[deliveryKey] || null;
  }

  savePushRetry({ accountId, deliveryKey, reminderId, scheduledAt, attempts, maxAttempts, lastAttemptAt, nextRetryAt, failed, removed, subscriptions }) {
    this.state.pushRetries[accountId] ||= {};
    const retry = {
      accountId,
      deliveryKey,
      reminderId: sanitizeStoredName(reminderId),
      scheduledAt: typeof scheduledAt === "string" ? scheduledAt : null,
      attempts: Number(attempts) || 0,
      maxAttempts: Number(maxAttempts) || 0,
      lastAttemptAt,
      nextRetryAt,
      failed: Number(failed) || 0,
      removed: Number(removed) || 0,
      subscriptions: Number(subscriptions) || 0,
    };
    this.state.pushRetries[accountId][deliveryKey] = retry;
    deleteAccountStateKey(this.state.pushFailures, accountId, deliveryKey);
    this.persist();
    return retry;
  }

  clearPushRetry({ accountId, deliveryKey }) {
    if (!this.state.pushRetries[accountId]?.[deliveryKey]) {
      return;
    }
    deleteAccountStateKey(this.state.pushRetries, accountId, deliveryKey);
    this.persist();
  }

  hasPushFailure(accountId, deliveryKey) {
    return Boolean(this.state.pushFailures[accountId]?.[deliveryKey]);
  }

  getPushFailure(accountId, deliveryKey) {
    return this.state.pushFailures[accountId]?.[deliveryKey] || null;
  }

  savePushFailure({ accountId, deliveryKey, reminderId, scheduledAt, attempts, maxAttempts, failedAt, failed, removed, subscriptions }) {
    this.state.pushFailures[accountId] ||= {};
    const failure = {
      accountId,
      deliveryKey,
      reminderId: sanitizeStoredName(reminderId),
      scheduledAt: typeof scheduledAt === "string" ? scheduledAt : null,
      attempts: Number(attempts) || 0,
      maxAttempts: Number(maxAttempts) || 0,
      failedAt,
      failed: Number(failed) || 0,
      removed: Number(removed) || 0,
      subscriptions: Number(subscriptions) || 0,
    };
    this.state.pushFailures[accountId][deliveryKey] = failure;
    deleteAccountStateKey(this.state.pushRetries, accountId, deliveryKey);
    this.persist();
    return failure;
  }

  pruneReminderPushState({ accountId, reminders }) {
    const activeDeliveryKeys = new Set(
      (Array.isArray(reminders) ? reminders : [])
        .map(reminder => getReminderDeliveryKey(reminder))
        .filter(Boolean),
    );

    pruneAccountStateByKeys(this.state.pushDeliveries, accountId, activeDeliveryKeys);
    pruneAccountStateByKeys(this.state.pushRetries, accountId, activeDeliveryKeys);
    pruneAccountStateByKeys(this.state.pushFailures, accountId, activeDeliveryKeys);
  }

  pruneDeviceSessions(accountId, protectedDeviceId = "") {
    const protectedSessionKey = protectedDeviceId ? `${accountId}:${protectedDeviceId}` : "";
    const sessions = Object.entries(this.state.deviceSessions)
      .filter(([, session]) => isPlainObject(session) && session.accountId === accountId)
      .sort((first, second) => compareDeviceSessionsForRetention(first, second, protectedSessionKey));

    if (sessions.length <= MAX_DEVICE_SESSIONS_PER_ACCOUNT) {
      return;
    }

    const retainedKeys = new Set(sessions
      .slice(0, MAX_DEVICE_SESSIONS_PER_ACCOUNT)
      .map(([key]) => key));

    sessions.forEach(([key]) => {
      if (!retainedKeys.has(key)) {
        delete this.state.deviceSessions[key];
      }
    });
  }

  close() {}

  persist() {
    if (this.memoryOnly) {
      return;
    }

    mkdirSync(dirname(this.dbPath), { recursive: true });
    const tempPath = `${this.dbPath}.tmp`;
    writeFileSync(tempPath, JSON.stringify(this.state, null, 2));
    renameSync(tempPath, this.dbPath);
  }
}

function readState(dbPath, { profanityRules = DEFAULT_QUOTE_PROFANITY_RULES } = {}) {
  if (!existsSync(dbPath)) {
    return createEmptyState();
  }

  try {
    const parsed = JSON.parse(readFileSync(dbPath, "utf8"));
    return {
      accounts: isPlainObject(parsed.accounts) ? parsed.accounts : {},
      scheduleSnapshots: isPlainObject(parsed.scheduleSnapshots) ? parsed.scheduleSnapshots : {},
      reminderSnapshots: isPlainObject(parsed.reminderSnapshots) ? parsed.reminderSnapshots : {},
      taskSnapshots: isPlainObject(parsed.taskSnapshots) ? parsed.taskSnapshots : {},
      noteSnapshots: isPlainObject(parsed.noteSnapshots) ? parsed.noteSnapshots : {},
      birthdaySnapshots: isPlainObject(parsed.birthdaySnapshots) ? parsed.birthdaySnapshots : {},
      diarySnapshots: isPlainObject(parsed.diarySnapshots) ? parsed.diarySnapshots : {},
      pushSubscriptions: isPlainObject(parsed.pushSubscriptions) ? parsed.pushSubscriptions : {},
      pushDeliveries: isPlainObject(parsed.pushDeliveries) ? parsed.pushDeliveries : {},
      pushRetries: isPlainObject(parsed.pushRetries) ? parsed.pushRetries : {},
      pushFailures: isPlainObject(parsed.pushFailures) ? parsed.pushFailures : {},
      pushEvents: isPlainObject(parsed.pushEvents) ? parsed.pushEvents : {},
      entitlementEvents: isPlainObject(parsed.entitlementEvents) ? parsed.entitlementEvents : {},
      transcriptionEvents: isPlainObject(parsed.transcriptionEvents) ? parsed.transcriptionEvents : {},
      processedProviderEvents: isPlainObject(parsed.processedProviderEvents) ? parsed.processedProviderEvents : {},
      featureUsage: isPlainObject(parsed.featureUsage) ? parsed.featureUsage : {},
      deviceSessions: isPlainObject(parsed.deviceSessions) ? parsed.deviceSessions : {},
      quoteCategories: normalizeQuoteCategories(parsed.quoteCategories),
      quoteCatalog: normalizeQuoteCatalog(parsed.quoteCatalog, { profanityRules }),
      userQuotePreferences: isPlainObject(parsed.userQuotePreferences) ? parsed.userQuotePreferences : {},
      userHolidayPreferences: isPlainObject(parsed.userHolidayPreferences) ? parsed.userHolidayPreferences : {},
      dailyQuoteSets: isPlainObject(parsed.dailyQuoteSets) ? parsed.dailyQuoteSets : {},
      dailyQuoteSetItems: isPlainObject(parsed.dailyQuoteSetItems) ? parsed.dailyQuoteSetItems : {},
      favoriteQuotes: isPlainObject(parsed.favoriteQuotes) ? parsed.favoriteQuotes : {},
      quoteEvents: isPlainObject(parsed.quoteEvents) ? parsed.quoteEvents : {},
    };
  } catch {
    preserveUnreadableStateFile(dbPath);
    return createEmptyState();
  }
}

function preserveUnreadableStateFile(dbPath) {
  if (!existsSync(dbPath)) {
    return;
  }

  const backupPath = createCorruptStateBackupPath(dbPath);
  renameSync(dbPath, backupPath);
}

function createCorruptStateBackupPath(dbPath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${dbPath}.corrupt-${timestamp}-${randomUUID()}`;
}

function createEmptyState() {
  return {
    accounts: {},
    scheduleSnapshots: {},
    reminderSnapshots: {},
    taskSnapshots: {},
    noteSnapshots: {},
    birthdaySnapshots: {},
    diarySnapshots: {},
    pushSubscriptions: {},
    pushDeliveries: {},
    pushRetries: {},
    pushFailures: {},
    pushEvents: {},
    entitlementEvents: {},
    transcriptionEvents: {},
    processedProviderEvents: {},
    featureUsage: {},
    deviceSessions: {},
    quoteCategories: normalizeQuoteCategories(),
    quoteCatalog: [],
    userQuotePreferences: {},
    userHolidayPreferences: {},
    dailyQuoteSets: {},
    dailyQuoteSetItems: {},
    favoriteQuotes: {},
    quoteEvents: {},
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeQuoteCategories(categories = DEFAULT_QUOTE_CATEGORIES) {
  const source = Array.isArray(categories) && categories.length ? categories : DEFAULT_QUOTE_CATEGORIES;
  const seenCodes = new Set();

  return source
    .map((category, index) => normalizeQuoteCategory(category, index))
    .filter(category => {
      if (!category || seenCodes.has(category.code)) {
        return false;
      }
      seenCodes.add(category.code);
      return true;
    })
    .sort((first, second) => first.sortOrder - second.sortOrder);
}

function normalizeQuoteCategory(category, index = 0) {
  if (!isPlainObject(category)) {
    return null;
  }

  const code = sanitizeQuoteCategoryCode(category.code);
  const titleRu = sanitizeStoredName(category.titleRu || category.title || "");
  if (!code || !titleRu) {
    return null;
  }

  return {
    id: sanitizeQuoteId(category.id) || `quote-category-${code}`,
    code,
    titleRu,
    descriptionRu: sanitizeStoredText(category.descriptionRu || ""),
    sortOrder: Number.isFinite(Number(category.sortOrder)) ? Number(category.sortOrder) : index * 10,
    isActive: category.isActive !== false,
    minimumCatalogSize: Math.max(0, Math.floor(Number(category.minimumCatalogSize) || 450)),
  };
}

function normalizeQuoteCatalog(quotes = [], { profanityRules = DEFAULT_QUOTE_PROFANITY_RULES } = {}) {
  if (!Array.isArray(quotes)) {
    return [];
  }

  const seenHashes = new Set();
  const seenIds = new Set();
  return quotes
    .map(quote => normalizeQuoteRecord(quote, { profanityRules }))
    .filter(quote => {
      if (!quote || seenIds.has(quote.id) || seenHashes.has(quote.normalizedHash)) {
        return false;
      }
      seenIds.add(quote.id);
      seenHashes.add(quote.normalizedHash);
      return true;
    });
}

function normalizeQuoteRecord(quote, { profanityRules = DEFAULT_QUOTE_PROFANITY_RULES } = {}) {
  if (!isPlainObject(quote)) {
    return null;
  }

  const text = sanitizeStoredText(quote.text);
  const authorName = sanitizeStoredName(quote.authorName);
  const sourceTitle = sanitizeStoredText(quote.sourceTitle);
  const sourceReference = sanitizeStoredText(quote.sourceReference);
  if (!text || !authorName || !sourceTitle || !sourceReference) {
    return null;
  }

  const normalizedText = normalizeQuoteText(quote.normalizedText || text);
  const normalizedHash = sanitizeQuoteHash(quote.normalizedHash) || createQuoteHash(normalizedText);
  const profanityValidation = getQuoteProfanityValidationResult(quote, text, { profanityRules });
  const profanityFailed = profanityValidation.status === QUOTE_CONTENT_VALIDATION_FAILED;
  const categoryCodes = profanityFailed ? [] : normalizeQuoteCategoryCodes(quote.categoryCodes || quote.categories);
  const verificationStatus = profanityFailed
    ? "rejected"
    : sanitizeQuoteVerificationStatus(quote.verificationStatus);

  return {
    id: sanitizeQuoteId(quote.id) || randomUUID(),
    text,
    normalizedText,
    normalizedHash,
    authorName,
    authorNameOriginal: sanitizeStoredName(quote.authorNameOriginal) || null,
    sourceTitle,
    sourceType: sanitizeQuoteSourceType(quote.sourceType),
    sourceReference,
    sourceUrl: normalizeUrl(quote.sourceUrl || ""),
    publicationYear: normalizeQuotePublicationYear(quote.publicationYear),
    originalLanguage: sanitizeStoredName(quote.originalLanguage) || null,
    displayLanguage: quote.displayLanguage === QUOTE_LANGUAGE ? QUOTE_LANGUAGE : QUOTE_LANGUAGE,
    translatorName: sanitizeStoredName(quote.translatorName) || null,
    verificationStatus,
    rightsStatus: sanitizeQuoteRightsStatus(quote.rightsStatus),
    rightsNote: sanitizeStoredText(quote.rightsNote || ""),
    mood: sanitizeStoredName(quote.mood) || null,
    lengthType: sanitizeQuoteLengthType(quote.lengthType || getQuoteLengthType(text)),
    isActive: profanityFailed ? false : quote.isActive !== false,
    contentValidation: profanityFailed ? QUOTE_CONTENT_VALIDATION_FAILED : QUOTE_CONTENT_VALIDATION_PASSED,
    rejectionCode: profanityFailed ? QUOTE_REJECTION_PROFANITY_DETECTED : null,
    profanityValidation,
    verifiedBy: sanitizeStoredName(quote.verifiedBy) || null,
    verifiedAt: normalizeTimestamp(quote.verifiedAt),
    createdAt: normalizeTimestamp(quote.createdAt) || new Date(0).toISOString(),
    updatedAt: normalizeTimestamp(quote.updatedAt) || normalizeTimestamp(quote.createdAt) || new Date(0).toISOString(),
    categoryCodes,
  };
}

function cloneQuoteCatalog(quotes = []) {
  if (!Array.isArray(quotes)) {
    return [];
  }

  return quotes
    .filter(isPlainObject)
    .map(quote => ({
      ...quote,
      categoryCodes: Array.isArray(quote.categoryCodes) ? [...quote.categoryCodes] : [],
      profanityValidation: isPlainObject(quote.profanityValidation)
        ? {
            ...quote.profanityValidation,
            matchedRuleIds: Array.isArray(quote.profanityValidation.matchedRuleIds)
              ? [...quote.profanityValidation.matchedRuleIds]
              : [],
          }
        : quote.profanityValidation,
    }));
}

function normalizeUserQuotePreferences(preferences, { accountId, timezone, checkedAt } = {}) {
  const source = isPlainObject(preferences) ? preferences : {};
  const selectedCategoryCodes = normalizeQuoteCategoryCodes(source.selectedCategoryCodes);
  const selectionMode = source.selectionMode === "selected_categories" && selectedCategoryCodes.length > 0
    ? "selected_categories"
    : "any";
  const normalizedTimezone = normalizeTimezone(source.timezone || timezone);
  const checkedLocalDate = getLocalDateString(checkedAt || new Date().toISOString(), normalizedTimezone);
  const effectiveFromLocalDate = normalizeLocalDate(source.effectiveFromLocalDate) || checkedLocalDate;

  return {
    accountId: String(source.userId || source.accountId || accountId || "").trim(),
    selectionMode,
    selectedCategoryCodes: selectionMode === "selected_categories" ? selectedCategoryCodes.slice(0, 3) : [],
    timezone: normalizedTimezone,
    language: QUOTE_LANGUAGE,
    excludeReligiousQuotes: source.excludeReligiousQuotes === true,
    excludePoliticalQuotes: source.excludePoliticalQuotes === true,
    excludeSadQuotes: source.excludeSadQuotes === true,
    effectiveFromLocalDate,
    createdAt: normalizeTimestamp(source.createdAt) || normalizeTimestamp(checkedAt) || new Date().toISOString(),
    updatedAt: normalizeTimestamp(source.updatedAt) || normalizeTimestamp(checkedAt) || new Date().toISOString(),
  };
}

function normalizeDailyQuoteSet(set) {
  if (!isPlainObject(set)) {
    return null;
  }

  const accountId = String(set.accountId || "").trim();
  const localDate = normalizeLocalDate(set.localDate);
  const timezone = normalizeTimezone(set.timezone);
  if (!accountId || !localDate) {
    return null;
  }

  return {
    id: sanitizeQuoteId(set.id) || createDailyQuoteSetKey(accountId, localDate),
    accountId,
    localDate,
    timezone,
    validFromUtc: normalizeTimestamp(set.validFromUtc),
    validUntilUtc: normalizeTimestamp(set.validUntilUtc),
    generationReason: sanitizeQuoteGenerationReason(set.generationReason),
    status: set.status === "failed" ? "failed" : "ready",
    createdAt: normalizeTimestamp(set.createdAt) || new Date().toISOString(),
  };
}

function normalizeDailyQuoteSetItems(items, setId) {
  if (!Array.isArray(items)) {
    return [];
  }

  const seenPositions = new Set();
  const seenQuotes = new Set();
  return items
    .map(item => normalizeDailyQuoteSetItem(item, setId))
    .filter(item => {
      if (!item || seenPositions.has(item.position) || seenQuotes.has(item.quoteId)) {
        return false;
      }
      seenPositions.add(item.position);
      seenQuotes.add(item.quoteId);
      return true;
    })
    .sort((first, second) => first.position - second.position);
}

function normalizeDailyQuoteSetItem(item, setId) {
  if (!isPlainObject(item)) {
    return null;
  }

  const quoteId = sanitizeQuoteId(item.quoteId);
  const position = Math.floor(Number(item.position));
  if (!quoteId || position < 1 || position > QUOTES_PER_DAY) {
    return null;
  }

  return {
    setId: sanitizeQuoteId(item.setId) || setId,
    quoteId,
    position,
    selectedCategoryCode: sanitizeQuoteCategoryCode(item.selectedCategoryCode) || QUOTE_CATEGORY_ANY_CODE,
    createdAt: normalizeTimestamp(item.createdAt) || new Date().toISOString(),
  };
}

function normalizeQuoteText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[«»"“”„]/g, "")
    .replace(/[.,!?;:—–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createQuoteHash(normalizedText) {
  return createHash("sha256").update(String(normalizedText || "")).digest("hex");
}

export function createQuoteProfanityRulesFromTerms(terms = [], { idPrefix = "custom-profanity-rule" } = {}) {
  const normalizedPrefix = sanitizeProfanityRuleId(idPrefix) || "custom-profanity-rule";
  return normalizeQuoteProfanityRules(
    (Array.isArray(terms) ? terms : [])
      .map((term, index) => ({
        id: `${normalizedPrefix}-${index + 1}`,
        terms: [term],
      })),
  );
}

export function validateQuoteProfanity(text, { rules = DEFAULT_QUOTE_PROFANITY_RULES } = {}) {
  const normalizedRules = normalizeQuoteProfanityRules(rules);
  const candidates = createQuoteProfanityCandidates(text);
  const matchedRuleIds = [];

  normalizedRules.forEach(rule => {
    const matched = rule.terms.some(term => candidates.compact.some(candidate => candidate.includes(term))
      || candidates.masked.some(candidate => maskedProfanityCandidateMatchesTerm(candidate, term)));
    if (matched) {
      matchedRuleIds.push(rule.id);
    }
  });

  if (matchedRuleIds.length) {
    return {
      status: QUOTE_CONTENT_VALIDATION_FAILED,
      code: QUOTE_REJECTION_PROFANITY_DETECTED,
      matchedRuleIds,
    };
  }

  return createPassedProfanityValidationResult();
}

function getQuoteProfanityValidationResult(quote, text, { profanityRules = DEFAULT_QUOTE_PROFANITY_RULES } = {}) {
  const computed = validateQuoteProfanity(text, { rules: profanityRules });
  const hasProvidedResult = isPlainObject(quote)
    && (Object.prototype.hasOwnProperty.call(quote, "profanityValidation")
      || Object.prototype.hasOwnProperty.call(quote, "profanity_validation"));
  const provided = hasProvidedResult
    ? normalizeProvidedProfanityValidationResult(quote.profanityValidation ?? quote.profanity_validation)
    : null;

  if (computed.status === QUOTE_CONTENT_VALIDATION_FAILED) {
    return computed;
  }

  if (hasProvidedResult && !provided) {
    return createFailedProfanityValidationResult([PROFANITY_VALIDATION_INVALID_RULE_ID]);
  }

  if (provided?.status === QUOTE_CONTENT_VALIDATION_FAILED) {
    return provided;
  }

  return createPassedProfanityValidationResult();
}

function normalizeProvidedProfanityValidationResult(result) {
  if (!isPlainObject(result)) {
    return null;
  }

  const matchedRuleIds = Array.isArray(result.matchedRuleIds)
    ? result.matchedRuleIds.map(sanitizeProfanityRuleId).filter(Boolean).slice(0, 20)
    : [];

  if (result.status === QUOTE_CONTENT_VALIDATION_PASSED && result.code === QUOTE_PROFANITY_NOT_DETECTED) {
    return createPassedProfanityValidationResult();
  }

  if (result.status === QUOTE_CONTENT_VALIDATION_FAILED && result.code === QUOTE_REJECTION_PROFANITY_DETECTED) {
    return createFailedProfanityValidationResult(matchedRuleIds.length ? matchedRuleIds : [PROFANITY_VALIDATION_INVALID_RULE_ID]);
  }

  return null;
}

function createPassedProfanityValidationResult() {
  return {
    status: QUOTE_CONTENT_VALIDATION_PASSED,
    code: QUOTE_PROFANITY_NOT_DETECTED,
    matchedRuleIds: [],
  };
}

function createFailedProfanityValidationResult(matchedRuleIds = []) {
  return {
    status: QUOTE_CONTENT_VALIDATION_FAILED,
    code: QUOTE_REJECTION_PROFANITY_DETECTED,
    matchedRuleIds: [...new Set(matchedRuleIds.map(sanitizeProfanityRuleId).filter(Boolean))],
  };
}

function normalizeQuoteProfanityRules(rules = DEFAULT_QUOTE_PROFANITY_RULES) {
  const source = Array.isArray(rules) ? rules : [];
  const seenRuleIds = new Set();
  return source
    .map((rule, index) => normalizeQuoteProfanityRule(rule, index))
    .filter(rule => {
      if (!rule || seenRuleIds.has(rule.id)) {
        return false;
      }
      seenRuleIds.add(rule.id);
      return true;
    });
}

function normalizeQuoteProfanityRule(rule, index = 0) {
  if (!isPlainObject(rule)) {
    return null;
  }

  const id = sanitizeProfanityRuleId(rule.id) || `profanity-rule-${index + 1}`;
  const terms = Array.isArray(rule.terms) ? rule.terms : [];
  const normalizedTerms = [...new Set(terms.flatMap(createQuoteProfanityTermVariants))]
    .filter(term => term.length >= 3)
    .slice(0, 100);

  return normalizedTerms.length ? { id, terms: normalizedTerms } : null;
}

function createQuoteProfanityTermVariants(term) {
  return createQuoteProfanityTextVariants(term)
    .map(compactProfanityText)
    .filter(Boolean);
}

function createQuoteProfanityCandidates(text) {
  const variants = createQuoteProfanityTextVariants(text);
  return {
    compact: [...new Set(variants.map(compactProfanityText).filter(Boolean))],
    masked: [...new Set(variants.map(createMaskedProfanityText).filter(Boolean))],
  };
}

function createQuoteProfanityTextVariants(value) {
  const normalized = normalizeProfanityBaseText(value);
  if (!normalized) {
    return [];
  }

  const leetNormalized = replaceProfanityLeetCharacters(normalized);
  const confusableNormalized = replaceProfanityConfusableCharacters(leetNormalized);
  const transliterated = transliterateLatinProfanityText(leetNormalized);
  const confusableTransliterated = transliterateLatinProfanityText(confusableNormalized);

  return [
    normalized,
    leetNormalized,
    confusableNormalized,
    transliterated,
    confusableTransliterated,
  ].filter(Boolean);
}

function normalizeProfanityBaseText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\u0451/g, "\u0435");
}

function compactProfanityText(value) {
  return normalizeProfanityBaseText(value)
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function createMaskedProfanityText(value) {
  let result = "";
  for (const char of normalizeProfanityBaseText(value)) {
    if (/[\p{L}\p{N}]/u.test(char)) {
      result += char;
    } else if (isProfanityMaskCharacter(char)) {
      result += "*";
    } else {
      result += "|";
    }
  }
  return result.replace(/\*+/g, "*").replace(/\|+/g, "|");
}

function isProfanityMaskCharacter(char) {
  return /[*#_?•·]/u.test(char);
}

function replaceProfanityLeetCharacters(value) {
  const replacements = new Map([
    ["0", "\u043e"],
    ["1", "\u0438"],
    ["3", "\u0435"],
    ["4", "\u0430"],
    ["5", "\u0441"],
    ["6", "\u0431"],
    ["7", "\u0442"],
    ["8", "\u0432"],
    ["9", "\u0434"],
    ["@", "\u0430"],
    ["$", "\u0441"],
  ]);
  return replaceCharacters(value, replacements);
}

function replaceProfanityConfusableCharacters(value) {
  const replacements = new Map([
    ["a", "\u0430"],
    ["c", "\u0441"],
    ["e", "\u0435"],
    ["k", "\u043a"],
    ["m", "\u043c"],
    ["o", "\u043e"],
    ["p", "\u0440"],
    ["t", "\u0442"],
    ["x", "\u0445"],
    ["y", "\u0443"],
  ]);
  return replaceCharacters(value, replacements);
}

function replaceCharacters(value, replacements) {
  let result = "";
  for (const char of String(value || "")) {
    result += replacements.get(char) || char;
  }
  return result;
}

function transliterateLatinProfanityText(value) {
  const chunks = [
    ["shch", "\u0449"],
    ["yo", "\u0435"],
    ["yu", "\u044e"],
    ["ya", "\u044f"],
    ["ye", "\u0435"],
    ["zh", "\u0436"],
    ["kh", "\u0445"],
    ["ts", "\u0446"],
    ["ch", "\u0447"],
    ["sh", "\u0448"],
    ["ju", "\u044e"],
    ["ja", "\u044f"],
  ];
  const single = new Map([
    ["a", "\u0430"],
    ["b", "\u0431"],
    ["v", "\u0432"],
    ["g", "\u0433"],
    ["d", "\u0434"],
    ["e", "\u0435"],
    ["z", "\u0437"],
    ["i", "\u0438"],
    ["j", "\u0439"],
    ["y", "\u0439"],
    ["k", "\u043a"],
    ["l", "\u043b"],
    ["m", "\u043c"],
    ["n", "\u043d"],
    ["o", "\u043e"],
    ["p", "\u043f"],
    ["r", "\u0440"],
    ["s", "\u0441"],
    ["t", "\u0442"],
    ["u", "\u0443"],
    ["f", "\u0444"],
    ["h", "\u0445"],
    ["x", "\u0445"],
    ["c", "\u043a"],
    ["q", "\u043a"],
    ["w", "\u0432"],
  ]);

  let result = "";
  for (let index = 0; index < value.length;) {
    const matchedChunk = chunks.find(([source]) => value.startsWith(source, index));
    if (matchedChunk) {
      result += matchedChunk[1];
      index += matchedChunk[0].length;
      continue;
    }

    const char = value[index];
    result += single.get(char) || char;
    index += 1;
  }
  return result;
}

function maskedProfanityCandidateMatchesTerm(candidate, term) {
  const tokens = [...String(candidate || "")];
  const termChars = [...String(term || "")];
  if (!tokens.length || termChars.length < 3) {
    return false;
  }

  const visibleThreshold = Math.max(2, Math.ceil(termChars.length * 0.35));
  for (let start = 0; start < tokens.length; start += 1) {
    const maxSpan = Math.max(termChars.length * 3, termChars.length + 12);
    const memo = new Set();
    if (matchesMaskedProfanityFrom(tokens, termChars, start, start, 0, 0, visibleThreshold, maxSpan, memo)) {
      return true;
    }
  }
  return false;
}

function matchesMaskedProfanityFrom(tokens, termChars, start, tokenIndex, termIndex, visibleCount, visibleThreshold, maxSpan, memo) {
  if (termIndex >= termChars.length) {
    return visibleCount >= visibleThreshold;
  }

  if (tokenIndex >= tokens.length || tokenIndex - start > maxSpan) {
    return false;
  }

  const memoKey = `${tokenIndex}:${termIndex}:${Math.min(visibleCount, visibleThreshold)}`;
  if (memo.has(memoKey)) {
    return false;
  }
  memo.add(memoKey);

  const token = tokens[tokenIndex];
  if (token === "|") {
    return matchesMaskedProfanityFrom(tokens, termChars, start, tokenIndex + 1, termIndex, visibleCount, visibleThreshold, maxSpan, memo);
  }

  if (token === "*") {
    if (matchesMaskedProfanityFrom(tokens, termChars, start, tokenIndex + 1, termIndex, visibleCount, visibleThreshold, maxSpan, memo)) {
      return true;
    }

    for (let nextTermIndex = termIndex + 1; nextTermIndex <= termChars.length; nextTermIndex += 1) {
      if (matchesMaskedProfanityFrom(tokens, termChars, start, tokenIndex + 1, nextTermIndex, visibleCount, visibleThreshold, maxSpan, memo)) {
        return true;
      }
    }
    return false;
  }

  if (token !== termChars[termIndex]) {
    return false;
  }

  return matchesMaskedProfanityFrom(
    tokens,
    termChars,
    start,
    tokenIndex + 1,
    termIndex + 1,
    visibleCount + 1,
    visibleThreshold,
    maxSpan,
    memo,
  );
}

function createQuoteCatalogAuditReport(quotes, { checkedAt } = {}) {
  const blockedQuotes = (Array.isArray(quotes) ? quotes : [])
    .filter(quote => quote?.profanityValidation?.status === QUOTE_CONTENT_VALIDATION_FAILED);
  return {
    checkedAt: normalizeTimestamp(checkedAt) || new Date().toISOString(),
    totalQuotes: Array.isArray(quotes) ? quotes.length : 0,
    blockedQuotes: blockedQuotes.length,
    blockedQuoteIds: blockedQuotes.map(quote => quote.id).filter(Boolean),
    matchedRuleIds: [...new Set(blockedQuotes.flatMap(quote => quote.profanityValidation.matchedRuleIds || []))],
  };
}

function createCodePointTerms(items) {
  return (Array.isArray(items) ? items : [])
    .map(item => Array.isArray(item) ? String.fromCodePoint(...item) : "")
    .filter(Boolean);
}

function sanitizeProfanityRuleId(value) {
  const normalized = String(value || "").trim();
  return /^[a-zA-Z0-9_.:-]{1,120}$/.test(normalized) ? normalized : "";
}

function sanitizeStoredText(value, maxLength = 2000) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeQuoteId(value) {
  const normalized = String(value || "").trim();
  return /^[a-zA-Z0-9_.:-]{1,160}$/.test(normalized) ? normalized : "";
}

function sanitizeQuoteHash(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^[a-f0-9]{32,128}$/.test(normalized) ? normalized : "";
}

function sanitizeQuoteCategoryCode(value) {
  const normalized = String(value || "").trim();
  return /^[a-z][a-z0-9_]{1,80}$/.test(normalized) ? normalized : "";
}

function normalizeQuoteCategoryCodes(value) {
  const source = Array.isArray(value) ? value : [];
  const activeCodes = new Set(DEFAULT_QUOTE_CATEGORIES.map(category => category.code));
  const seen = new Set();
  return source
    .map(sanitizeQuoteCategoryCode)
    .filter(code => code && activeCodes.has(code) && !seen.has(code) && seen.add(code));
}

function sanitizeQuoteSourceType(value) {
  return [
    "book",
    "article",
    "speech",
    "interview",
    "letter",
    "diary",
    "other",
  ].includes(value) ? value : "other";
}

function sanitizeQuoteVerificationStatus(value) {
  return [
    "draft",
    "unverified",
    "verified",
    "rejected",
    "archived",
  ].includes(value) ? value : "draft";
}

function sanitizeQuoteRightsStatus(value) {
  return [
    "public_domain",
    "licensed",
    "permission_granted",
    "review_required",
  ].includes(value) ? value : "review_required";
}

function sanitizeQuoteLengthType(value) {
  return ["short", "medium", "long"].includes(value) ? value : "medium";
}

function getQuoteLengthType(text) {
  const length = String(text || "").length;
  if (length <= 90) return "short";
  if (length <= 220) return "medium";
  return "long";
}

function normalizeQuotePublicationYear(value) {
  const year = Math.floor(Number(value));
  return year >= -3000 && year <= 3000 ? year : null;
}

function normalizeLocalDate(value) {
  const normalized = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function normalizeTimezone(value) {
  const timezone = String(value || QUOTE_DEFAULT_TIMEZONE).trim();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return QUOTE_DEFAULT_TIMEZONE;
  }
}

function sanitizeQuoteGenerationReason(value) {
  return [
    QUOTE_SCHEDULED_REASON,
    QUOTE_FALLBACK_REASON,
    "admin_rebuild",
  ].includes(value) ? value : QUOTE_FALLBACK_REASON;
}

function sanitizeQuoteEventType(value) {
  return [
    "daily_quotes_generated",
    "daily_quotes_generation_failed",
    "daily_quotes_recovery_used",
    "daily_quotes_opened",
    "quote_favorited",
    "quote_unfavorited",
    "quote_preferences_updated",
    "quote_catalog_fallback_applied",
  ].includes(value) ? value : "daily_quotes_opened";
}

function createDailyQuoteSetKey(accountId, localDate) {
  return `${accountId}:${localDate}`;
}

function createDefaultAccountEntitlements() {
  return {
    voiceTranscription: {
      enabled: false,
      source: "none",
      updatedAt: null,
      activatedAt: null,
      expiresAt: null,
      paymentId: null,
    },
  };
}

function normalizeAccountEntitlements(entitlements, updatedAt = null, checkedAt = null) {
  const source = isPlainObject(entitlements) ? entitlements : {};
  return {
    voiceTranscription: normalizeFeatureEntitlement(
      source.voiceTranscription ?? source.voice_transcription,
      updatedAt,
      checkedAt,
    ),
  };
}

function normalizeFeatureEntitlement(entitlement, updatedAt = null, checkedAt = null) {
  if (entitlement === true) {
    return {
      enabled: true,
      source: "manual",
      updatedAt: normalizeTimestamp(updatedAt),
      activatedAt: normalizeTimestamp(updatedAt),
      expiresAt: null,
      paymentId: null,
    };
  }

  if (!isPlainObject(entitlement)) {
    return {
      enabled: false,
      source: "none",
      updatedAt: null,
      activatedAt: null,
      expiresAt: null,
      paymentId: null,
    };
  }

  const normalizedUpdatedAt = normalizeTimestamp(entitlement.updatedAt) ||
    (entitlement.enabled === true ? normalizeTimestamp(updatedAt) : null);
  const activatedAt = normalizeTimestamp(entitlement.activatedAt) || normalizedUpdatedAt;
  const expiresAt = normalizeTimestamp(entitlement.expiresAt);
  const paymentId = normalizeYooKassaPaymentId(entitlement.paymentId) || null;
  const source = sanitizeEntitlementSource(entitlement.source);

  if (entitlement.enabled !== true) {
    return {
      enabled: false,
      source: source || "none",
      updatedAt: normalizedUpdatedAt,
      activatedAt,
      expiresAt,
      paymentId,
    };
  }

  if (isExpiredAt(expiresAt, checkedAt)) {
    return {
      enabled: false,
      source: "expired",
      updatedAt: normalizedUpdatedAt,
      activatedAt,
      expiresAt,
      paymentId,
    };
  }

  return {
    enabled: true,
    source: source || "manual",
    updatedAt: normalizedUpdatedAt,
    activatedAt,
    expiresAt,
    paymentId,
  };
}

function normalizeTimestamp(value) {
  const timestamp = String(value || "").trim();
  if (!timestamp) return null;

  const time = Date.parse(timestamp);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function isExpiredAt(expiresAt, checkedAt) {
  if (!expiresAt || !checkedAt) return false;

  const expiresTime = Date.parse(expiresAt);
  const checkedTime = Date.parse(checkedAt);
  return Number.isFinite(expiresTime) && Number.isFinite(checkedTime) && expiresTime <= checkedTime;
}

function addDays(timestamp, days) {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return null;
  return new Date(time + days * 24 * 60 * 60 * 1000).toISOString();
}

function createSubscriptionFeatureEntitlement({
  currentEntitlement,
  source,
  checkedAt,
  paymentId,
  periodDays = DEFAULT_FOCUS_PLUS_PERIOD_DAYS,
}) {
  const current = normalizeFeatureEntitlement(currentEntitlement, null, checkedAt);
  const normalizedPaymentId = normalizeYooKassaPaymentId(paymentId) || null;

  if (normalizedPaymentId && current.paymentId === normalizedPaymentId) {
    return current;
  }

  const checkedTime = Date.parse(checkedAt);
  const currentExpiryTime = current.enabled && current.expiresAt ? Date.parse(current.expiresAt) : NaN;
  const startsAt = Number.isFinite(currentExpiryTime) && currentExpiryTime > checkedTime
    ? new Date(currentExpiryTime).toISOString()
    : normalizeTimestamp(checkedAt);

  return {
    enabled: true,
    source,
    updatedAt: normalizeTimestamp(checkedAt),
    activatedAt: normalizeTimestamp(checkedAt),
    expiresAt: addDays(startsAt, periodDays),
    paymentId: normalizedPaymentId,
  };
}

function saveEntitlementAuditEvent(db, {
  accountId,
  featureKey,
  origin,
  status,
  source,
  paymentId,
  paymentStatus,
  paid,
  reason,
  entitlement,
  checkedAt,
}) {
  return db.saveEntitlementEvent({
    accountId,
    featureKey,
    origin,
    status,
    source,
    paymentId,
    paymentStatus,
    paid,
    reason,
    expiresAt: entitlement?.expiresAt,
    createdAt: checkedAt,
  });
}

function sanitizeEntitlementSource(value) {
  const source = String(value || "").trim();
  return ENTITLEMENT_SOURCE_PATTERN.test(source) ? source : "";
}

function normalizePaidFeatureKey(value) {
  const featureKey = String(value || "").trim();
  if (featureKey === "voice_transcription") {
    return VOICE_TRANSCRIPTION_FEATURE_KEY;
  }
  return PAID_FEATURE_KEYS.has(featureKey) ? featureKey : "";
}

function normalizeFeatureUsageEntry({
  accountId,
  featureKey,
  usage,
  checkedAt,
  limit = DEFAULT_VOICE_TRANSCRIPTION_MONTHLY_LIMIT,
}) {
  const period = createMonthlyUsagePeriod(checkedAt);
  const normalizedUsage = isPlainObject(usage) && usage.period === period ? usage : {};
  const normalizedLimit = normalizeMonthlyUsageLimit(limit);
  const used = normalizeUsageCount(normalizedUsage.used);

  return {
    accountId,
    featureKey,
    period,
    used,
    limit: normalizedLimit,
    remaining: Math.max(0, normalizedLimit - used),
    resetAt: createMonthlyUsageResetAt(period),
    updatedAt: normalizeTimestamp(normalizedUsage.updatedAt),
  };
}

function createMonthlyUsagePeriod(timestamp) {
  const time = Date.parse(timestamp);
  const date = Number.isFinite(time) ? new Date(time) : new Date();
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function createMonthlyUsageResetAt(period) {
  const [yearText, monthText] = String(period || "").split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)).toISOString();
}

function normalizeMonthlyUsageLimit(value) {
  const limit = Math.floor(Number(value));
  return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_VOICE_TRANSCRIPTION_MONTHLY_LIMIT;
}

function normalizeUsageCount(value) {
  const count = Math.floor(Number(value));
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function normalizeVoiceTranscriptionRequest(body) {
  if (!isPlainObject(body)) return null;

  const rawAudio = String(body.audioBase64 ?? body.audio ?? "").trim();
  const dataUrlMatch = rawAudio.match(/^data:([^;,]+);base64,(.+)$/i);
  const audioBase64 = normalizeTranscriptionAudioBase64(rawAudio);
  const mimeType = normalizeTranscriptionMimeType(body.mimeType ?? body.type ?? dataUrlMatch?.[1]);
  const durationMs = normalizeTranscriptionDurationMs(body.durationMs);

  if (!audioBase64 || !mimeType || durationMs === null) {
    return null;
  }

  return {
    audioBase64,
    mimeType,
    durationMs,
    language: normalizeTranscriptionLanguage(body.language),
    prompt: sanitizeTranscriptionPrompt(body.prompt),
  };
}

function normalizeTranscriptionDurationMs(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return 0;
  }

  const durationMs = Math.floor(Number(value));
  return Number.isFinite(durationMs) && durationMs >= 0 && durationMs <= MAX_TRANSCRIPTION_DURATION_MS
    ? durationMs
    : null;
}

function normalizeTranscriptionAudioBase64(value) {
  const rawAudio = String(value || "").trim();
  const dataUrlMatch = rawAudio.match(/^data:[^;,]+;base64,(.+)$/i);
  const normalized = String(dataUrlMatch?.[1] || rawAudio).replace(/\s+/g, "");

  if (normalized.length < 16 || normalized.length > MAX_TRANSCRIPTION_AUDIO_BASE64_LENGTH) {
    return "";
  }

  return /^[a-zA-Z0-9+/_-]+={0,2}$/.test(normalized) ? normalized : "";
}

function normalizeTranscriptionMimeType(value) {
  const mimeType = String(value || "").split(";")[0].trim().toLowerCase();
  return TRANSCRIPTION_MIME_TYPES.has(mimeType) ? mimeType : "";
}

function normalizeTranscriptionLanguage(value) {
  const language = String(value || "").trim();
  return /^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})?$/.test(language) ? language : "ru-RU";
}

function sanitizeTranscriptionPrompt(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 500);
}

function createVoiceTranscriptionProviderConfig(env = process.env) {
  const provider = normalizeVoiceTranscriptionProviderName(
    env.FOCUS_VOICE_TRANSCRIPTION_PROVIDER ||
    env.FOCUS_TRANSCRIPTION_PROVIDER ||
    "",
  );

  if (provider !== "localEcho") {
    if (provider !== "openai") {
      return null;
    }

    return createOpenAITranscriptionProviderConfig({
      apiKey: env.FOCUS_OPENAI_API_KEY || env.OPENAI_API_KEY || "",
      model: env.FOCUS_OPENAI_TRANSCRIPTION_MODEL || env.OPENAI_TRANSCRIPTION_MODEL || "",
      transcriptionsUrl: env.FOCUS_OPENAI_TRANSCRIPTION_URL || env.OPENAI_TRANSCRIPTION_URL || "",
      timeoutMs: env.FOCUS_OPENAI_TRANSCRIPTION_TIMEOUT_MS || env.OPENAI_TRANSCRIPTION_TIMEOUT_MS || "",
      organization: env.FOCUS_OPENAI_ORGANIZATION || env.OPENAI_ORG_ID || env.OPENAI_ORGANIZATION || "",
      project: env.FOCUS_OPENAI_PROJECT || env.OPENAI_PROJECT_ID || "",
    });
  }

  return {
    provider,
    text: sanitizeTranscriptionText(env.FOCUS_VOICE_TRANSCRIPTION_LOCAL_TEXT) || "Тестовая транскрибация работает.",
  };
}

function normalizeVoiceTranscriptionProviderConfig(config) {
  if (!isPlainObject(config)) {
    return null;
  }

  const provider = normalizeVoiceTranscriptionProviderName(config.provider);
  if (!provider) {
    return null;
  }

  if (provider === "localEcho") {
    return {
      provider,
      text: sanitizeTranscriptionText(config.text) || "Тестовая транскрибация работает.",
    };
  }

  if (provider === "openai") {
    return createOpenAITranscriptionProviderConfig(config);
  }

  if (typeof config.transcribe === "function") {
    return {
      provider,
      transcribe: config.transcribe,
    };
  }

  return null;
}

function normalizeVoiceTranscriptionProviderName(value) {
  const provider = String(value || "").trim();
  if (["local", "localEcho", "local_echo", "test", "testProvider"].includes(provider)) {
    return provider === "testProvider" ? "testProvider" : "localEcho";
  }
  if (["openai", "openAI", "openai_audio", "openai-transcribe", "openai_transcription"].includes(provider)) {
    return "openai";
  }

  return sanitizeProviderEventPart(provider);
}

function createOpenAITranscriptionProviderConfig({
  apiKey,
  model,
  transcriptionsUrl,
  url,
  timeoutMs,
  organization,
  project,
} = {}) {
  const normalizedApiKey = normalizeOpenAIApiKey(apiKey);
  const normalizedModel = normalizeOpenAITranscriptionModel(model);
  const normalizedUrl = normalizeUrl(transcriptionsUrl || url || DEFAULT_OPENAI_TRANSCRIPTION_URL);

  if (!normalizedApiKey || !normalizedModel || !normalizedUrl) {
    return null;
  }

  return {
    provider: "openai",
    apiKey: normalizedApiKey,
    model: normalizedModel,
    transcriptionsUrl: normalizedUrl,
    timeoutMs: normalizeOpenAITranscriptionTimeoutMs(timeoutMs),
    organization: sanitizeHttpHeaderValue(organization),
    project: sanitizeHttpHeaderValue(project),
  };
}

function normalizeOpenAIApiKey(value) {
  const apiKey = String(value || "").trim();
  return apiKey.length >= 20 && !/[\r\n]/.test(apiKey) ? apiKey : "";
}

function normalizeOpenAITranscriptionModel(value) {
  const model = String(value || "").trim() || DEFAULT_OPENAI_TRANSCRIPTION_MODEL;
  return /^[a-zA-Z0-9_.:-]{1,120}$/.test(model) ? model : DEFAULT_OPENAI_TRANSCRIPTION_MODEL;
}

function normalizeOpenAITranscriptionTimeoutMs(value) {
  const timeoutMs = Math.floor(Number(value));
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return DEFAULT_OPENAI_TRANSCRIPTION_TIMEOUT_MS;
  }
  return Math.min(timeoutMs, 120000);
}

function sanitizeHttpHeaderValue(value) {
  const headerValue = String(value || "").trim();
  return headerValue && !/[\r\n]/.test(headerValue) ? headerValue.slice(0, 200) : "";
}

function sanitizeTranscriptionText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_TRANSCRIPTION_TEXT_LENGTH);
}

function getVoiceTranscriptionProviderTimeoutMs(providerConfig) {
  const timeoutMs = Math.floor(Number(providerConfig?.timeoutMs));
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : null;
}

async function transcribeVoiceAudio({ providerConfig, transcriptionRequest, checkedAt, fetchImpl }) {
  if (!providerConfig) {
    return {
      statusCode: 503,
      body: {
        error: "provider_not_configured",
        status: "provider_not_configured",
        provider: null,
        checkedAt,
      },
    };
  }

  if (providerConfig.provider === "localEcho") {
    return {
      statusCode: 200,
      body: {
        status: "transcribed",
        provider: providerConfig.provider,
        text: providerConfig.text,
        language: transcriptionRequest.language,
        checkedAt,
      },
    };
  }

  if (providerConfig.provider === "openai") {
    return transcribeWithOpenAIProvider({
      providerConfig,
      transcriptionRequest,
      checkedAt,
      fetchImpl,
    });
  }

  if (typeof providerConfig.transcribe !== "function") {
    return createFailedTranscriptionProviderResponse({
      provider: providerConfig.provider,
      reason: "provider_not_supported",
      checkedAt,
    });
  }

  try {
    const result = await providerConfig.transcribe({
      ...transcriptionRequest,
      checkedAt,
    });
    const text = sanitizeTranscriptionText(isPlainObject(result) ? result.text : result);

    if (!text) {
      return createFailedTranscriptionProviderResponse({
        provider: providerConfig.provider,
        reason: "empty_transcription",
        checkedAt,
      });
    }

    return {
      statusCode: 200,
      body: {
        status: "transcribed",
        provider: providerConfig.provider,
        text,
        language: normalizeTranscriptionLanguage(result?.language || transcriptionRequest.language),
        checkedAt,
      },
    };
  } catch {
    return createFailedTranscriptionProviderResponse({
      provider: providerConfig.provider,
      reason: "provider_error",
      checkedAt,
    });
  }
}

async function transcribeWithOpenAIProvider({ providerConfig, transcriptionRequest, checkedAt, fetchImpl }) {
  if (!fetchImpl || typeof FormData !== "function" || typeof Blob !== "function") {
    return createFailedTranscriptionProviderResponse({
      provider: providerConfig.provider,
      reason: "provider_unavailable",
      checkedAt,
    });
  }

  const audioBuffer = Buffer.from(transcriptionRequest.audioBase64, "base64");
  if (!audioBuffer.length) {
    return createFailedTranscriptionProviderResponse({
      provider: providerConfig.provider,
      reason: "no_audio",
      checkedAt,
    });
  }

  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer], { type: transcriptionRequest.mimeType }), getTranscriptionFileName(transcriptionRequest.mimeType));
  formData.append("model", providerConfig.model);
  formData.append("response_format", "json");

  const language = normalizeOpenAITranscriptionLanguage(transcriptionRequest.language);
  if (language) {
    formData.append("language", language);
  }

  if (transcriptionRequest.prompt) {
    formData.append("prompt", transcriptionRequest.prompt);
  }

  const headers = {
    authorization: `Bearer ${providerConfig.apiKey}`,
  };
  if (providerConfig.organization) {
    headers["openai-organization"] = providerConfig.organization;
  }
  if (providerConfig.project) {
    headers["openai-project"] = providerConfig.project;
  }

  const abortController = typeof AbortController === "function" ? new AbortController() : null;
  const timeoutId = abortController
    ? setTimeout(() => abortController.abort(), providerConfig.timeoutMs || DEFAULT_OPENAI_TRANSCRIPTION_TIMEOUT_MS)
    : null;
  if (timeoutId && typeof timeoutId.unref === "function") {
    timeoutId.unref();
  }

  try {
    const response = await fetchImpl(providerConfig.transcriptionsUrl, {
      method: "POST",
      headers,
      body: formData,
      signal: abortController?.signal,
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return createFailedTranscriptionProviderResponse({
        provider: providerConfig.provider,
        reason: getOpenAITranscriptionFailureReason(response.status, result),
        checkedAt,
      });
    }

    const text = sanitizeTranscriptionText(result?.text);
    if (!text) {
      return createFailedTranscriptionProviderResponse({
        provider: providerConfig.provider,
        reason: "empty_transcription",
        checkedAt,
      });
    }

    return {
      statusCode: 200,
      body: {
        status: "transcribed",
        provider: providerConfig.provider,
        text,
        language: normalizeTranscriptionLanguage(result?.language || transcriptionRequest.language),
        checkedAt,
      },
    };
  } catch (error) {
    return createFailedTranscriptionProviderResponse({
      provider: providerConfig.provider,
      reason: isAbortError(error) ? "provider_timeout" : "provider_error",
      checkedAt,
    });
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function isAbortError(error) {
  return error?.name === "AbortError" || error?.code === "ABORT_ERR";
}

function normalizeOpenAITranscriptionLanguage(language) {
  const normalizedLanguage = normalizeTranscriptionLanguage(language);
  return normalizedLanguage.split("-")[0].toLowerCase();
}

function getTranscriptionFileName(mimeType) {
  const extensionByMimeType = {
    "audio/aac": "aac",
    "audio/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/webm": "webm",
    "audio/x-m4a": "m4a",
    "audio/x-wav": "wav",
  };
  return `focus-audio.${extensionByMimeType[mimeType] || "webm"}`;
}

function getOpenAITranscriptionFailureReason(statusCode, result) {
  const providerCode = sanitizeStoredName(result?.error?.code || result?.error?.type || "");
  if (providerCode === "insufficient_quota" || providerCode === "rate_limit_exceeded") {
    return "provider_rate_limited";
  }
  if (statusCode === 401 || statusCode === 403) {
    return "provider_auth_failed";
  }
  if (statusCode === 400 || statusCode === 413 || providerCode === "invalid_request_error") {
    return "provider_rejected_audio";
  }
  if (statusCode === 429) {
    return "provider_rate_limited";
  }
  return "provider_error";
}

function createFailedTranscriptionProviderResponse({ provider, reason, checkedAt }) {
  return {
    statusCode: 200,
    body: {
      error: "provider_failed",
      status: "failed",
      provider: sanitizeProviderEventPart(provider) || "unknown",
      reason: sanitizeStoredName(reason) || "provider_error",
      text: "",
      checkedAt,
    },
  };
}

function saveTranscriptionAuditEvent(db, {
  accountId,
  deviceId,
  transcriptionRequest,
  result,
  usage,
  spent,
  processingMs,
  checkedAt,
}) {
  return db.saveTranscriptionEvent({
    accountId,
    deviceId,
    status: result?.status,
    provider: result?.provider,
    reason: result?.reason || result?.error,
    mimeType: transcriptionRequest?.mimeType,
    durationMs: transcriptionRequest?.durationMs,
    processingMs,
    language: transcriptionRequest?.language,
    textLength: typeof result?.text === "string" ? result.text.length : 0,
    spent,
    usage,
    createdAt: checkedAt,
  });
}

async function createSubscriptionCheckout({
  checkoutBaseUrl,
  yookassaConfig,
  accountId,
  featureKey,
  checkedAt,
  createId,
  fetchImpl,
}) {
  const response = {
    status: "provider_not_configured",
    accountId,
    featureKey,
    checkoutUrl: null,
    checkedAt,
  };

  if (yookassaConfig) {
    return createYooKassaSubscriptionCheckout({
      yookassaConfig,
      accountId,
      featureKey,
      checkedAt,
      createId,
      fetchImpl,
    });
  }

  if (!checkoutBaseUrl) {
    return response;
  }

  const checkoutUrl = new URL(checkoutBaseUrl);
  checkoutUrl.searchParams.set("account", accountId);
  checkoutUrl.searchParams.set("feature", featureKey);

  return {
    ...response,
    status: "ready",
    checkoutUrl: checkoutUrl.href,
  };
}

function createYooKassaCheckoutConfig({
  shopId,
  secretKey,
  returnUrl,
  paymentsUrl = DEFAULT_YOOKASSA_PAYMENTS_URL,
  amountValue = DEFAULT_FOCUS_PLUS_AMOUNT_RUB,
} = {}) {
  const normalizedShopId = String(shopId || "").trim();
  const normalizedSecretKey = String(secretKey || "").trim();
  const normalizedReturnUrl = normalizeUrl(returnUrl || "");
  const normalizedPaymentsUrl = normalizeUrl(paymentsUrl || "");
  const normalizedAmountValue = normalizeMoneyAmount(amountValue);

  if (!normalizedShopId || !normalizedSecretKey || !normalizedReturnUrl || !normalizedPaymentsUrl || !normalizedAmountValue) {
    return null;
  }

  return {
    shopId: normalizedShopId,
    secretKey: normalizedSecretKey,
    returnUrl: normalizedReturnUrl,
    paymentsUrl: normalizedPaymentsUrl,
    amountValue: normalizedAmountValue,
    currency: "RUB",
  };
}

async function createYooKassaSubscriptionCheckout({
  yookassaConfig,
  accountId,
  featureKey,
  checkedAt,
  createId,
  fetchImpl,
}) {
  if (!fetchImpl) {
    return {
      status: "failed",
      accountId,
      featureKey,
      checkoutUrl: null,
      checkedAt,
      provider: "yookassa",
      error: "provider_unavailable",
    };
  }

  const requestBody = {
    amount: {
      value: yookassaConfig.amountValue,
      currency: yookassaConfig.currency,
    },
    capture: true,
    confirmation: {
      type: "redirect",
      return_url: yookassaConfig.returnUrl,
    },
    description: createYooKassaPaymentDescription(featureKey),
    metadata: {
      accountId,
      featureKey,
      focusAccountId: accountId,
      focusFeatureKey: featureKey,
    },
  };

  let response;
  try {
    response = await fetchImpl(yookassaConfig.paymentsUrl, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${yookassaConfig.shopId}:${yookassaConfig.secretKey}`).toString("base64")}`,
        "content-type": "application/json",
        "idempotence-key": createId(),
      },
      body: JSON.stringify(requestBody),
    });
  } catch {
    return {
      status: "failed",
      accountId,
      featureKey,
      checkoutUrl: null,
      checkedAt,
      provider: "yookassa",
      error: "provider_unavailable",
    };
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      status: "failed",
      accountId,
      featureKey,
      checkoutUrl: null,
      checkedAt,
      provider: "yookassa",
      error: normalizeYooKassaError(result),
    };
  }

  const checkoutUrl = typeof result?.confirmation?.confirmation_url === "string"
    ? result.confirmation.confirmation_url
    : "";

  return {
    status: checkoutUrl ? "ready" : "failed",
    accountId,
    featureKey,
    checkoutUrl: checkoutUrl || null,
    checkedAt,
    provider: "yookassa",
    paymentId: typeof result?.id === "string" ? result.id : null,
  };
}

function createYooKassaPaymentDescription(featureKey) {
  if (featureKey === "voiceTranscription") {
    return "Focus Plus: голосовой ввод";
  }

  return "Focus Plus";
}

function normalizeYooKassaError(result) {
  if (!isPlainObject(result)) {
    return "provider_error";
  }

  return String(result.code || result.type || result.error || "provider_error").slice(0, 120);
}

function normalizeYooKassaPaymentId(value) {
  const paymentId = String(value || "").trim();
  return YOOKASSA_PAYMENT_ID_PATTERN.test(paymentId) ? paymentId : "";
}

function sanitizeProviderEventPart(value) {
  const eventPart = String(value || "").trim();
  return PROVIDER_EVENT_PART_PATTERN.test(eventPart) ? eventPart : "";
}

function normalizeProviderEventKey(value) {
  const eventKey = String(value || "").trim();
  return PROVIDER_EVENT_KEY_PATTERN.test(eventKey) ? eventKey : "";
}

function createYooKassaWebhookEventKey(notification) {
  if (!isPlainObject(notification) || typeof notification.event !== "string") {
    return "";
  }

  const eventName = sanitizeProviderEventPart(notification.event);
  const payment = isPlainObject(notification.object) ? notification.object : {};
  const paymentId = normalizeYooKassaPaymentId(payment.id);
  if (!eventName || !paymentId) {
    return "";
  }

  const paymentStatus = sanitizeProviderEventPart(payment.status) || "unknown";
  const paidState = payment.paid === true ? "paid" : "unpaid";
  const { accountId, featureKey, rawFeatureKey } = extractYooKassaPaymentMetadata(payment);
  const accountPart = sanitizeProviderEventPart(accountId) || "account-missing";
  const featurePart = sanitizeProviderEventPart(featureKey || rawFeatureKey) || (rawFeatureKey ? "feature-unknown" : "feature-missing");
  const amount = isPlainObject(payment.amount) ? payment.amount : null;
  const amountPart = sanitizeProviderEventPart(normalizeMoneyAmount(amount?.value)) || "amount-missing";
  const currencyPart = sanitizeProviderEventPart(String(amount?.currency || "").trim().toUpperCase()) || "currency-missing";
  return normalizeProviderEventKey(
    `yookassa:${eventName}:${paymentId}:${paymentStatus}:${paidState}:${accountPart}:${featurePart}:${amountPart}:${currencyPart}`,
  );
}

function createYooKassaPaymentStatusUrl(yookassaConfig, paymentId) {
  return `${yookassaConfig.paymentsUrl}/${encodeURIComponent(paymentId)}`;
}

async function checkYooKassaPaymentStatus({
  db,
  yookassaConfig,
  accountId,
  paymentId,
  checkedAt,
  fetchImpl,
}) {
  const baseBody = {
    provider: "yookassa",
    accountId,
    paymentId,
    checkedAt,
  };

  if (!yookassaConfig) {
    return {
      statusCode: 503,
      body: {
        ...baseBody,
        status: "provider_not_configured",
        error: "provider_not_configured",
      },
    };
  }

  if (!fetchImpl) {
    saveEntitlementAuditEvent(db, {
      accountId,
      origin: "yookassa-status",
      status: "failed",
      source: "yookassa",
      paymentId,
      reason: "provider_unavailable",
      checkedAt,
    });
    return {
      statusCode: 200,
      body: {
        ...baseBody,
        status: "failed",
        error: "provider_unavailable",
      },
    };
  }

  let response;
  try {
    response = await fetchImpl(createYooKassaPaymentStatusUrl(yookassaConfig, paymentId), {
      method: "GET",
      headers: {
        authorization: `Basic ${Buffer.from(`${yookassaConfig.shopId}:${yookassaConfig.secretKey}`).toString("base64")}`,
      },
    });
  } catch {
    saveEntitlementAuditEvent(db, {
      accountId,
      origin: "yookassa-status",
      status: "failed",
      source: "yookassa",
      paymentId,
      reason: "provider_unavailable",
      checkedAt,
    });
    return {
      statusCode: 200,
      body: {
        ...baseBody,
        status: "failed",
        error: "provider_unavailable",
      },
    };
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = normalizeYooKassaError(result);
    saveEntitlementAuditEvent(db, {
      accountId,
      origin: "yookassa-status",
      status: "failed",
      source: "yookassa",
      paymentId,
      reason: error,
      checkedAt,
    });
    return {
      statusCode: 200,
      body: {
        ...baseBody,
        status: "failed",
        error,
      },
    };
  }

  const payment = isPlainObject(result) ? result : {};
  const providerPaymentId = normalizeYooKassaPaymentId(payment.id);
  const paymentStatus = typeof payment.status === "string" ? payment.status : "unknown";
  const paid = payment.paid === true;
  const { accountId: paymentAccountId, featureKey, rawFeatureKey } = extractYooKassaPaymentMetadata(payment);
  if (!providerPaymentId || providerPaymentId !== paymentId) {
    const reason = providerPaymentId ? "payment_id_mismatch" : "payment_id_missing";
    saveEntitlementAuditEvent(db, {
      accountId,
      featureKey,
      origin: "yookassa-status",
      status: "ignored",
      source: "yookassa",
      paymentId,
      paymentStatus,
      paid,
      reason,
      checkedAt,
    });
    return {
      statusCode: 200,
      body: {
        ...baseBody,
        status: "ignored",
        reason,
        providerPaymentId: providerPaymentId || null,
        paymentStatus,
        paid,
      },
    };
  }

  if (!paymentAccountId) {
    saveEntitlementAuditEvent(db, {
      accountId,
      origin: "yookassa-status",
      status: "ignored",
      source: "yookassa",
      paymentId,
      paymentStatus,
      paid,
      reason: "account_missing",
      checkedAt,
    });
    return {
      statusCode: 200,
      body: {
        ...baseBody,
        status: "ignored",
        reason: "account_missing",
        paymentStatus,
        paid,
      },
    };
  }

  if (paymentAccountId !== accountId) {
    saveEntitlementAuditEvent(db, {
      accountId,
      featureKey,
      origin: "yookassa-status",
      status: "ignored",
      source: "yookassa",
      paymentId,
      paymentStatus,
      paid,
      reason: "account_mismatch",
      checkedAt,
    });
    return {
      statusCode: 200,
      body: {
        ...baseBody,
        status: "ignored",
        reason: "account_mismatch",
        paymentStatus,
        paid,
      },
    };
  }

  if (!featureKey) {
    const reason = getYooKassaFeatureMetadataReason(rawFeatureKey);
    saveEntitlementAuditEvent(db, {
      accountId,
      origin: "yookassa-status",
      status: "ignored",
      source: "yookassa",
      paymentId,
      paymentStatus,
      paid,
      reason,
      checkedAt,
    });
    return {
      statusCode: 200,
      body: {
        ...baseBody,
        status: "ignored",
        reason,
        paymentStatus,
        paid,
      },
    };
  }

  if (paymentStatus === "succeeded" && paid) {
    const amountMismatchReason = getYooKassaPaymentAmountMismatchReason(payment, yookassaConfig);
    if (amountMismatchReason) {
      saveEntitlementAuditEvent(db, {
        accountId,
        featureKey,
        origin: "yookassa-status",
        status: "ignored",
        source: "yookassa",
        paymentId,
        paymentStatus,
        paid,
        reason: amountMismatchReason,
        checkedAt,
      });

      return {
        statusCode: 200,
        body: {
          ...baseBody,
          status: "ignored",
          reason: amountMismatchReason,
          featureKey,
          paymentStatus,
          paid,
        },
      };
    }

    const currentEntitlements = db.getAccountEntitlements(accountId, checkedAt);
    const subscriptionEntitlement = createSubscriptionFeatureEntitlement({
      currentEntitlement: currentEntitlements[featureKey],
      source: "yookassa",
      checkedAt,
      paymentId,
    });

    if (!subscriptionEntitlement.enabled) {
      saveEntitlementAuditEvent(db, {
        accountId,
        featureKey,
        origin: "yookassa-status",
        status: "ignored",
        source: "yookassa",
        paymentId,
        paymentStatus,
        paid,
        reason: "payment_already_applied",
        entitlement: currentEntitlements[featureKey],
        checkedAt,
      });
      return {
        statusCode: 200,
        body: {
          ...baseBody,
          status: "ignored",
          reason: "payment_already_applied",
          featureKey,
          paymentStatus,
          paid,
          entitlements: currentEntitlements,
        },
      };
    }

    const entitlements = {
      ...currentEntitlements,
      [featureKey]: subscriptionEntitlement,
    };
    const savedEntitlements = db.setAccountEntitlements({
      accountId,
      entitlements,
      updatedAt: checkedAt,
    });
    saveEntitlementAuditEvent(db, {
      accountId,
      featureKey,
      origin: "yookassa-status",
      status: "activated",
      source: "yookassa",
      paymentId,
      paymentStatus,
      paid,
      entitlement: savedEntitlements[featureKey],
      checkedAt,
    });

    return {
      statusCode: 200,
      body: {
        ...baseBody,
        status: "activated",
        featureKey,
        paymentStatus,
        paid,
        entitlements: savedEntitlements,
      },
    };
  }

  if (paymentStatus === "canceled") {
    saveEntitlementAuditEvent(db, {
      accountId,
      featureKey,
      origin: "yookassa-status",
      status: "canceled",
      source: "yookassa",
      paymentId,
      paymentStatus,
      paid,
      checkedAt,
    });
  }

  return {
    statusCode: 200,
    body: {
      ...baseBody,
      status: paymentStatus === "canceled" ? "canceled" : "pending",
      featureKey,
      paymentStatus,
      paid,
    },
  };
}

function applyYooKassaWebhookNotification({ db, notification, checkedAt, yookassaConfig }) {
  if (!isPlainObject(notification) || notification.type !== "notification" || typeof notification.event !== "string") {
    return {
      statusCode: 400,
      body: { error: "invalid_yookassa_notification" },
    };
  }

  const payment = isPlainObject(notification.object) ? notification.object : {};
  const paymentId = normalizeYooKassaPaymentId(payment.id) || null;
  const paymentStatus = typeof payment.status === "string" ? payment.status : "unknown";
  const paid = payment.paid === true;
  const { accountId, featureKey, rawFeatureKey } = extractYooKassaPaymentMetadata(payment);

  if (notification.event !== "payment.succeeded" || payment.status !== "succeeded" || payment.paid !== true) {
    if (accountId && db.getAccount(accountId)) {
      saveEntitlementAuditEvent(db, {
        accountId,
        featureKey,
        origin: "yookassa-webhook",
        status: paymentStatus === "canceled" ? "canceled" : "ignored",
        source: "yookassa",
        paymentId,
        paymentStatus,
        paid,
        reason: "event_not_activating",
        checkedAt,
      });
    }

    return {
      statusCode: 200,
      body: {
        status: "ignored",
        reason: "event_not_activating",
        event: notification.event,
      },
    };
  }

  if (!accountId) {
    return {
      statusCode: 200,
      body: {
        status: "ignored",
        reason: "account_missing",
        event: notification.event,
      },
    };
  }

  if (!featureKey) {
    const reason = getYooKassaFeatureMetadataReason(rawFeatureKey);
    if (db.getAccount(accountId)) {
      saveEntitlementAuditEvent(db, {
        accountId,
        origin: "yookassa-webhook",
        status: "ignored",
        source: "yookassa",
        paymentId,
        paymentStatus,
        paid,
        reason,
        checkedAt,
      });
    }

    return {
      statusCode: 200,
      body: {
        status: "ignored",
        reason,
        event: notification.event,
        accountId,
      },
    };
  }

  if (!db.getAccount(accountId)) {
    return {
      statusCode: 200,
      body: {
        status: "ignored",
        reason: "account_not_found",
        event: notification.event,
        accountId,
        featureKey,
      },
    };
  }

  if (!paymentId) {
    saveEntitlementAuditEvent(db, {
      accountId,
      featureKey,
      origin: "yookassa-webhook",
      status: "ignored",
      source: "yookassa",
      paymentStatus,
      paid,
      reason: "payment_missing",
      checkedAt,
    });

    return {
      statusCode: 200,
      body: {
        status: "ignored",
        reason: "payment_missing",
        event: notification.event,
        accountId,
        featureKey,
      },
    };
  }

  const amountMismatchReason = getYooKassaPaymentAmountMismatchReason(payment, yookassaConfig);
  if (amountMismatchReason) {
    saveEntitlementAuditEvent(db, {
      accountId,
      featureKey,
      origin: "yookassa-webhook",
      status: "ignored",
      source: "yookassa",
      paymentId,
      paymentStatus,
      paid,
      reason: amountMismatchReason,
      checkedAt,
    });

    return {
      statusCode: 200,
      body: {
        status: "ignored",
        reason: amountMismatchReason,
        event: notification.event,
        accountId,
        featureKey,
        paymentId,
      },
    };
  }

  const currentEntitlements = db.getAccountEntitlements(accountId, checkedAt);
  const subscriptionEntitlement = createSubscriptionFeatureEntitlement({
    currentEntitlement: currentEntitlements[featureKey],
    source: "yookassa",
    checkedAt,
    paymentId,
  });

  if (!subscriptionEntitlement.enabled) {
    saveEntitlementAuditEvent(db, {
      accountId,
      featureKey,
      origin: "yookassa-webhook",
      status: "ignored",
      source: "yookassa",
      paymentId,
      paymentStatus,
      paid,
      reason: "payment_already_applied",
      entitlement: currentEntitlements[featureKey],
      checkedAt,
    });

    return {
      statusCode: 200,
      body: {
        status: "ignored",
        reason: "payment_already_applied",
        event: notification.event,
        accountId,
        featureKey,
        paymentId,
        checkedAt,
        entitlements: currentEntitlements,
      },
    };
  }

  const entitlements = {
    ...currentEntitlements,
    [featureKey]: subscriptionEntitlement,
  };
  const savedEntitlements = db.setAccountEntitlements({
    accountId,
    entitlements,
    updatedAt: checkedAt,
  });
  saveEntitlementAuditEvent(db, {
    accountId,
    featureKey,
    origin: "yookassa-webhook",
    status: "activated",
    source: "yookassa",
    paymentId,
    paymentStatus,
    paid,
    entitlement: savedEntitlements[featureKey],
    checkedAt,
  });

  return {
    statusCode: 200,
    body: {
      status: "activated",
      accountId,
      featureKey,
      paymentId,
      checkedAt,
      entitlements: savedEntitlements,
    },
  };
}

function createProcessedYooKassaWebhookResponse({ processedEvent, eventKey, notification, checkedAt }) {
  const payment = isPlainObject(notification.object) ? notification.object : {};
  const { accountId, featureKey } = extractYooKassaPaymentMetadata(payment);
  return {
    statusCode: 200,
    body: {
      status: "ignored",
      reason: "webhook_event_already_processed",
      provider: "yookassa",
      event: sanitizeProviderEventPart(notification.event) || processedEvent?.eventName || null,
      eventKey,
      accountId: processedEvent?.accountId || accountId || null,
      featureKey: processedEvent?.featureKey || featureKey || null,
      paymentId: processedEvent?.paymentId || normalizeYooKassaPaymentId(payment.id) || null,
      checkedAt,
      firstProcessedAt: processedEvent?.createdAt || null,
    },
  };
}

function saveProcessedYooKassaWebhookEvent({ db, eventKey, notification, result, checkedAt }) {
  if (!eventKey || !result || result.statusCode < 200 || result.statusCode >= 300) {
    return null;
  }

  const payment = isPlainObject(notification.object) ? notification.object : {};
  const { accountId, featureKey } = extractYooKassaPaymentMetadata(payment);
  return db.saveProcessedProviderEvent({
    eventKey,
    provider: "yookassa",
    eventName: notification.event,
    accountId,
    featureKey,
    paymentId: payment.id,
    paymentStatus: payment.status,
    paid: payment.paid === true,
    status: result.body?.status,
    reason: result.body?.reason || result.body?.error,
    createdAt: checkedAt,
  });
}

function extractYooKassaPaymentMetadata(payment) {
  const metadata = isPlainObject(payment?.metadata) ? payment.metadata : {};
  const rawFeatureKey = String(metadata.focusFeatureKey ?? metadata.featureKey ?? metadata.feature ?? "").trim();
  return {
    accountId: String(metadata.focusAccountId || metadata.accountId || metadata.account || "").trim(),
    featureKey: normalizePaidFeatureKey(rawFeatureKey),
    rawFeatureKey,
  };
}

function getYooKassaFeatureMetadataReason(rawFeatureKey) {
  return String(rawFeatureKey || "").trim() ? "feature_unknown" : "feature_missing";
}

function getYooKassaPaymentAmountMismatchReason(payment, yookassaConfig) {
  if (!yookassaConfig) {
    return "";
  }

  const amount = isPlainObject(payment?.amount) ? payment.amount : null;
  if (!amount) {
    return "amount_missing";
  }

  const value = normalizeMoneyAmount(amount.value);
  const expectedValue = normalizeMoneyAmount(yookassaConfig.amountValue);
  const currency = String(amount.currency || "").trim().toUpperCase();
  const expectedCurrency = String(yookassaConfig.currency || "").trim().toUpperCase();
  if (!expectedValue || value !== expectedValue) {
    return "amount_mismatch";
  }

  if (!expectedCurrency || currency !== expectedCurrency) {
    return "currency_mismatch";
  }

  return "";
}

function pruneAccountStateByKeys(stateByAccount, accountId, activeKeys) {
  const accountState = stateByAccount[accountId];
  if (!isPlainObject(accountState)) {
    return;
  }

  Object.keys(accountState).forEach(key => {
    if (!activeKeys.has(key)) {
      delete accountState[key];
    }
  });

  if (Object.keys(accountState).length === 0) {
    delete stateByAccount[accountId];
  }
}

function deleteAccountStateKey(stateByAccount, accountId, key) {
  const accountState = stateByAccount[accountId];
  if (!isPlainObject(accountState) || !Object.hasOwn(accountState, key)) {
    return false;
  }

  delete accountState[key];
  if (Object.keys(accountState).length === 0) {
    delete stateByAccount[accountId];
  }

  return true;
}

function compareProcessedProviderEventsForRetention(firstEntry, secondEntry) {
  const [firstKey, firstEvent] = firstEntry;
  const [secondKey, secondEvent] = secondEntry;
  return String(secondEvent.createdAt || "").localeCompare(String(firstEvent.createdAt || "")) ||
    secondKey.localeCompare(firstKey);
}

function compareDeviceSessionsForRetention(firstEntry, secondEntry, protectedSessionKey) {
  const [firstKey, firstSession] = firstEntry;
  const [secondKey, secondSession] = secondEntry;

  if (protectedSessionKey) {
    if (firstKey === protectedSessionKey) return -1;
    if (secondKey === protectedSessionKey) return 1;
  }

  return String(secondSession.lastSeenAt || "").localeCompare(String(firstSession.lastSeenAt || "")) ||
    String(secondSession.firstSeenAt || "").localeCompare(String(firstSession.firstSeenAt || "")) ||
    firstKey.localeCompare(secondKey);
}

function normalizePushSubscription(subscription) {
  if (!isPlainObject(subscription) || !isPlainObject(subscription.keys)) {
    return null;
  }

  const endpoint = String(subscription.endpoint || "").trim();
  const p256dh = String(subscription.keys.p256dh || "").trim();
  const auth = String(subscription.keys.auth || "").trim();

  if (!isHttpsUrl(endpoint) || endpoint.length > MAX_PUSH_ENDPOINT_LENGTH) {
    return null;
  }

  if (!p256dh || !auth || p256dh.length > MAX_PUSH_KEY_LENGTH || auth.length > MAX_PUSH_KEY_LENGTH) {
    return null;
  }

  return {
    endpoint,
    expirationTime: normalizePushExpirationTime(subscription.expirationTime),
    keys: {
      p256dh,
      auth,
    },
  };
}

function normalizePushExpirationTime(expirationTime) {
  if (expirationTime === null || expirationTime === undefined) {
    return null;
  }

  const parsed = Number(expirationTime);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizePushEventType(type) {
  return ["test", "reminder"].includes(type) ? type : "test";
}

function sanitizePushEventStatus(status) {
  return ["sent", "failed", "empty", "no-subscriptions", "retry-exhausted"].includes(status) ? status : "failed";
}

function sanitizeEntitlementEventOrigin(origin) {
  return ["admin", "yookassa-webhook", "yookassa-status"].includes(origin) ? origin : "admin";
}

function sanitizeEntitlementEventStatus(status) {
  return ["activated", "disabled", "ignored", "failed", "canceled"].includes(status) ? status : "ignored";
}

function sanitizeTranscriptionEventStatus(status) {
  return [
    "locked",
    "invalid",
    "usage_limit_exceeded",
    "provider_not_configured",
    "failed",
    "transcribed",
  ].includes(status) ? status : "failed";
}

function normalizeTranscriptionTextLength(value) {
  const length = Math.floor(Number(value));
  return Number.isFinite(length) && length > 0 ? Math.min(length, MAX_TRANSCRIPTION_TEXT_LENGTH) : 0;
}

function normalizeTranscriptionEventDurationMs(value) {
  const durationMs = Math.floor(Number(value));
  return Number.isFinite(durationMs) && durationMs > 0 ? Math.min(durationMs, MAX_TRANSCRIPTION_DURATION_MS) : 0;
}

function normalizeTranscriptionEventProcessingMs(value) {
  const processingMs = Math.floor(Number(value));
  return Number.isFinite(processingMs) && processingMs > 0 ? Math.min(processingMs, MAX_TRANSCRIPTION_PROCESSING_MS) : 0;
}

function normalizeTranscriptionEventUsage(usage) {
  if (!isPlainObject(usage)) {
    return null;
  }

  return {
    period: sanitizeStoredName(usage.period),
    used: normalizeUsageCount(usage.used),
    limit: normalizeMonthlyUsageLimit(usage.limit),
    remaining: normalizeUsageCount(usage.remaining),
    resetAt: normalizeTimestamp(usage.resetAt),
  };
}

function createOrbitAuthConfig(env = process.env) {
  const issuer = normalizeUrl(env.ORBIT_AUTH_ISSUER || DEFAULT_AUTH_ISSUER);
  const redirectUri = normalizeUrl(
    env.ORBIT_AUTH_REDIRECT_URI ||
    env.FOCUS_AUTH_REDIRECT_URI ||
    "https://focus-v2.dmnao83.ru/api/auth/callback"
  );
  const scope = sanitizeStoredName(env.ORBIT_AUTH_SCOPE || DEFAULT_AUTH_SCOPE) || DEFAULT_AUTH_SCOPE;

  return {
    issuer,
    authorizationEndpoint: `${issuer}/oauth/authorize`,
    tokenEndpoint: `${issuer}/oauth/token`,
    userinfoEndpoint: `${issuer}/userinfo`,
    clientId: sanitizeStoredName(env.ORBIT_AUTH_CLIENT_ID || env.FOCUS_AUTH_CLIENT_ID || "") || "",
    clientSecret: typeof env.ORBIT_AUTH_CLIENT_SECRET === "string" ? env.ORBIT_AUTH_CLIENT_SECRET : "",
    redirectUri,
    scope,
  };
}

export function createFocusSyncServer({
  db = createSyncDatabase(),
  now = () => new Date().toISOString(),
  createId = randomUUID,
  pushPublicKey = process.env.FOCUS_VAPID_PUBLIC_KEY || "",
  pushPrivateKey = process.env.FOCUS_VAPID_PRIVATE_KEY || "",
  pushSubject = process.env.FOCUS_VAPID_SUBJECT || "mailto:focus@dmnao83.ru",
  pushSender = createWebPushSender({ publicKey: pushPublicKey, privateKey: pushPrivateKey, subject: pushSubject }),
  pushCheckIntervalMs = DEFAULT_PUSH_INTERVAL_MS,
  authConfig = createOrbitAuthConfig(),
  authSessions = new Map(),
  fetchImpl = globalThis.fetch,
  subscriptionCheckoutUrl = normalizeUrl(process.env.FOCUS_SUBSCRIPTION_CHECKOUT_URL || ""),
  yookassaConfig = createYooKassaCheckoutConfig({
    shopId: process.env.FOCUS_YOOKASSA_SHOP_ID,
    secretKey: process.env.FOCUS_YOOKASSA_SECRET_KEY,
    returnUrl: process.env.FOCUS_YOOKASSA_RETURN_URL,
    paymentsUrl: DEFAULT_YOOKASSA_PAYMENTS_URL,
    amountValue: DEFAULT_FOCUS_PLUS_AMOUNT_RUB,
  }),
  adminToken = normalizeSecretToken(process.env.FOCUS_ADMIN_TOKEN || ""),
  yookassaWebhookToken = normalizeSecretToken(process.env.FOCUS_YOOKASSA_WEBHOOK_TOKEN || ""),
  voiceTranscriptionMonthlyLimit = DEFAULT_VOICE_TRANSCRIPTION_MONTHLY_LIMIT,
  voiceTranscriptionProvider = createVoiceTranscriptionProviderConfig(),
  logger = console,
} = {}) {
  const normalizedVoiceTranscriptionProvider = normalizeVoiceTranscriptionProviderConfig(voiceTranscriptionProvider);
  if (db && typeof db.auditQuoteCatalogForProduction === "function") {
    db.auditQuoteCatalogForProduction();
  }
  const server = http.createServer(async (request, response) => {
    try {
      await routeRequest({
        request,
        response,
        db,
        now,
        createId,
        pushPublicKey,
        pushSender,
        authConfig,
        authSessions,
        fetchImpl,
        subscriptionCheckoutUrl,
        yookassaConfig,
        adminToken,
        yookassaWebhookToken,
        voiceTranscriptionMonthlyLimit,
        voiceTranscriptionProvider: normalizedVoiceTranscriptionProvider,
      });
    } catch (error) {
      if (isHttpRequestError(error)) {
        sendJson(response, error.status, {
          error: error.code,
          message: error.message,
        });
        return;
      }

      sendJson(response, 500, {
        error: "sync_server_error",
        message: error instanceof Error ? error.message : "Unknown sync error.",
      });
    }
  });

  if (pushSender && pushCheckIntervalMs > 0) {
    const timer = setInterval(() => {
      runBackgroundReminderDispatch({ db, now, pushSender, logger });
    }, pushCheckIntervalMs);
    timer.unref?.();
    server.on("close", () => clearInterval(timer));
  }

  return server;
}

async function routeRequest({ request, response, db, now, createId, pushPublicKey, pushSender, authConfig, authSessions, fetchImpl, subscriptionCheckoutUrl, yookassaConfig, adminToken, yookassaWebhookToken, voiceTranscriptionMonthlyLimit, voiceTranscriptionProvider }) {
  const url = new URL(request.url || "/", "http://127.0.0.1");

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true, service: "focus-sync" });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/auth/session") {
    sendJson(response, 200, getAuthSessionResponse({ request, authConfig, authSessions }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/auth/login") {
    await startAuthLogin({ request, response, url, authConfig, createId });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/auth/callback") {
    await finishAuthLogin({ request, response, url, db, authConfig, authSessions, createId, now, fetchImpl });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    logoutAuthSession({ request, response, authSessions });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/push/config") {
    sendJson(response, 200, {
      configured: Boolean(pushPublicKey),
      publicKey: pushPublicKey || null,
    });
    return;
  }

  if (url.pathname === "/api/holiday-calendars/professional-categories") {
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    sendJson(response, 200, {
      status: "ok",
      categories: getProfessionalHolidayCategories(),
      selectionModes: [
        { code: "none", title: "Не показывать" },
        { code: "all", title: "Показывать все" },
        { code: "selected", title: "Выбрать направления" },
      ],
    });
    return;
  }

  if (url.pathname === "/api/holiday-calendars/version") {
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    const version = getHolidayCatalogVersion({
      countryCode: url.searchParams.get("country") || "RU",
      year: url.searchParams.get("year") || new Date(now()).getUTCFullYear(),
    });

    if (!version) {
      sendJson(response, 404, { error: "holiday_catalog_not_found" });
      return;
    }

    sendJson(response, 200, version);
    return;
  }

  if (url.pathname === "/api/holiday-calendars/published") {
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    const catalog = getPublishedHolidayCatalog({
      countryCode: url.searchParams.get("country") || "RU",
      year: url.searchParams.get("year") || new Date(now()).getUTCFullYear(),
    });

    if (!catalog) {
      sendJson(response, 404, { error: "holiday_catalog_not_found" });
      return;
    }

    sendJson(response, 200, {
      status: "ok",
      ...catalog,
    });
    return;
  }

  if (url.pathname === "/api/holiday-preferences") {
    const accountContext = getExistingAccountContext({ request, response, db, now });
    if (!accountContext) return;

    if (request.method === "GET") {
      sendJson(response, 200, {
        status: "ok",
        accountId: accountContext.accountId,
        preferences: db.getUserHolidayPreferences(accountContext.accountId) || normalizeHolidayPreferences({
          setupCompleted: false,
          updatedAt: accountContext.checkedAt,
        }),
        checkedAt: accountContext.checkedAt,
      });
      return;
    }

    if (request.method === "PUT") {
      const body = await readJsonBody(request, { optional: true });
      const validation = validateHolidayPreferences(body || {});
      if (!validation.ok) {
        sendJson(response, 400, {
          error: "invalid_holiday_preferences",
          details: validation.errors,
        });
        return;
      }

      const saved = db.saveUserHolidayPreferences({
        accountId: accountContext.accountId,
        preferences: {
          ...validation.preferences,
          setupCompleted: true,
        },
        updatedAt: accountContext.checkedAt,
      });

      sendJson(response, 200, {
        status: "saved",
        accountId: accountContext.accountId,
        preferences: saved,
        checkedAt: accountContext.checkedAt,
      });
      return;
    }

    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  if (url.pathname === "/api/quotes/categories") {
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    sendJson(response, 200, getQuoteCategoriesResponse(db));
    return;
  }

  if (url.pathname === "/api/quotes/preferences") {
    const accountContext = getExistingAccountContext({ request, response, db, now });
    if (!accountContext) return;

    const timezone = normalizeTimezone(url.searchParams.get("timezone") || request.headers["x-focus-timezone"]);

    if (request.method === "GET") {
      sendJson(response, 200, getQuotePreferencesResponse(db, {
        accountId: accountContext.accountId,
        timezone,
        checkedAt: accountContext.checkedAt,
      }));
      return;
    }

    if (request.method === "PUT") {
      const body = await readJsonBody(request, { optional: true });
      const result = saveQuotePreferencesFromRequest(db, {
        accountId: accountContext.accountId,
        body,
        timezone,
        checkedAt: accountContext.checkedAt,
      });
      sendJson(response, result.statusCode, result.body);
      return;
    }

    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  if (url.pathname === "/api/quotes/today") {
    const accountContext = getExistingAccountContext({ request, response, db, now });
    if (!accountContext) return;

    if (request.method !== "GET") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    const result = getTodayQuotesResponse(db, {
      accountId: accountContext.accountId,
      timezone: url.searchParams.get("timezone") || request.headers["x-focus-timezone"],
      checkedAt: accountContext.checkedAt,
      createId,
    });
    sendJson(response, result.statusCode, result.body);
    return;
  }

  const quoteFavoriteMatch = url.pathname.match(/^\/api\/quotes\/([^/]+)\/favorite$/);
  if (quoteFavoriteMatch) {
    const accountContext = getExistingAccountContext({ request, response, db, now });
    if (!accountContext) return;

    const quoteId = sanitizeQuoteId(decodeURIComponent(quoteFavoriteMatch[1]));
    if (!quoteId || !db.getQuoteCatalog().some(quote => quote.id === quoteId && isQuoteEligibleForProduction(quote))) {
      sendJson(response, 404, { error: "quote_not_found" });
      return;
    }

    if (request.method === "POST") {
      const favorite = db.saveFavoriteQuote({
        accountId: accountContext.accountId,
        quoteId,
        createdAt: accountContext.checkedAt,
      });
      db.saveQuoteEvent({
        accountId: accountContext.accountId,
        eventType: "quote_favorited",
        quoteId,
        createdAt: accountContext.checkedAt,
      });
      sendJson(response, 200, {
        accountId: accountContext.accountId,
        quoteId,
        isFavorite: true,
        createdAt: favorite.createdAt,
      });
      return;
    }

    if (request.method === "DELETE") {
      db.removeFavoriteQuote({
        accountId: accountContext.accountId,
        quoteId,
      });
      db.saveQuoteEvent({
        accountId: accountContext.accountId,
        eventType: "quote_unfavorited",
        quoteId,
        createdAt: accountContext.checkedAt,
      });
      sendJson(response, 200, {
        accountId: accountContext.accountId,
        quoteId,
        isFavorite: false,
      });
      return;
    }

    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  if (url.pathname === "/api/push/subscriptions/status") {
    const accountContext = getExistingAccountContext({ request, response, db, now });
    if (!accountContext) return;

    if (request.method !== "GET") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    sendJson(response, 200, getPushSubscriptionStatus(db, {
      accountId: accountContext.accountId,
      deviceId: accountContext.deviceId,
      configured: Boolean(pushPublicKey),
    }));
    return;
  }

  if (url.pathname === "/api/push/reminders/status") {
    const accountContext = getExistingAccountContext({ request, response, db, now });
    if (!accountContext) return;

    if (request.method !== "GET") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    sendJson(response, 200, getReminderDeliveryDiagnostics(db, {
      accountId: accountContext.accountId,
      now: now(),
    }));
    return;
  }

  if (url.pathname === "/api/push/events") {
    const accountContext = getExistingAccountContext({ request, response, db, now });
    if (!accountContext) return;

    if (request.method !== "GET") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    sendJson(response, 200, {
      accountId: accountContext.accountId,
      events: db.listPushEvents(accountContext.accountId, 8),
    });
    return;
  }

  if (url.pathname === "/api/push/test") {
    const accountContext = getExistingAccountContext({ request, response, db, now });
    if (!accountContext) return;

    if (request.method !== "POST") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    if (!pushSender) {
      sendJson(response, 503, { error: "push_not_configured" });
      return;
    }

    sendJson(response, 200, await dispatchTestPushNotification({
      db,
      accountId: accountContext.accountId,
      deviceId: accountContext.deviceId,
      pushSender,
      now,
    }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/sync/accounts") {
    const body = await readJsonBody(request, { optional: true });
    const accountId = createId();
    const createdAt = now();
    db.createAccount({
      accountId,
      displayName: typeof body?.displayName === "string" ? body.displayName.slice(0, 120) : null,
      createdAt,
    });
    sendJson(response, 201, { accountId, createdAt });
    return;
  }

  if (url.pathname === "/api/sync/account") {
    const accountContext = getExistingAccountContext({ request, response, db, now });
    if (!accountContext) return;

    if (request.method === "GET") {
      sendJson(response, 200, getAccountProfile(db, {
        accountId: accountContext.accountId,
        deviceId: accountContext.deviceId,
      }));
      return;
    }

    if (request.method === "PATCH") {
      const body = await readJsonBody(request, { optional: true });
      if (body !== null && !isPlainObject(body)) {
        sendJson(response, 400, { error: "invalid_account_profile" });
        return;
      }

      if (Object.prototype.hasOwnProperty.call(body || {}, "displayName")) {
        db.updateAccount({
          accountId: accountContext.accountId,
          displayName: body.displayName,
          updatedAt: accountContext.checkedAt,
        });
      }

      if (Object.prototype.hasOwnProperty.call(body || {}, "deviceName")) {
        db.updateDeviceSession({
          accountId: accountContext.accountId,
          deviceId: accountContext.deviceId,
          deviceName: body.deviceName,
          updatedAt: accountContext.checkedAt,
        });
      }

      sendJson(response, 200, getAccountProfile(db, {
        accountId: accountContext.accountId,
        deviceId: accountContext.deviceId,
      }));
      return;
    }

    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  if (url.pathname === "/api/sync/entitlements") {
    const accountContext = getExistingAccountContext({ request, response, db, now });
    if (!accountContext) return;

    if (request.method !== "GET") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    sendJson(response, 200, getAccountEntitlements(db, {
      accountId: accountContext.accountId,
      checkedAt: accountContext.checkedAt,
    }));
    return;
  }

  if (url.pathname === "/api/sync/entitlements/events") {
    const accountContext = getExistingAccountContext({ request, response, db, now });
    if (!accountContext) return;

    if (request.method !== "GET") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    sendJson(response, 200, {
      accountId: accountContext.accountId,
      events: db.listEntitlementEvents(accountContext.accountId, 12),
    });
    return;
  }

  if (url.pathname === "/api/sync/transcription/status") {
    const accountContext = getExistingAccountContext({ request, response, db, now });
    if (!accountContext) return;

    if (request.method !== "GET") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    sendJson(response, 200, {
      accountId: accountContext.accountId,
      featureKey: VOICE_TRANSCRIPTION_FEATURE_KEY,
      providerConfigured: Boolean(voiceTranscriptionProvider),
      provider: voiceTranscriptionProvider?.provider || null,
      providerModel: voiceTranscriptionProvider?.model || null,
      providerTimeoutMs: getVoiceTranscriptionProviderTimeoutMs(voiceTranscriptionProvider),
      monthlyLimit: normalizeMonthlyUsageLimit(voiceTranscriptionMonthlyLimit),
      maxDurationMs: MAX_TRANSCRIPTION_DURATION_MS,
      checkedAt: accountContext.checkedAt,
    });
    return;
  }

  if (url.pathname === "/api/sync/transcription/events") {
    const accountContext = getExistingAccountContext({ request, response, db, now });
    if (!accountContext) return;

    if (request.method !== "GET") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    sendJson(response, 200, {
      accountId: accountContext.accountId,
      events: db.listTranscriptionEvents(accountContext.accountId, 12),
    });
    return;
  }

  if (url.pathname === "/api/sync/transcription") {
    const accountContext = getExistingAccountContext({ request, response, db, now });
    if (!accountContext) return;

    if (request.method !== "POST") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    const entitlement = db.getAccountEntitlements(
      accountContext.accountId,
      accountContext.checkedAt,
    )[VOICE_TRANSCRIPTION_FEATURE_KEY];

    if (!entitlement?.enabled) {
      saveTranscriptionAuditEvent(db, {
        accountId: accountContext.accountId,
        deviceId: accountContext.deviceId,
        result: {
          status: "locked",
          reason: "feature_locked",
        },
        checkedAt: accountContext.checkedAt,
      });
      sendJson(response, 402, {
        error: "feature_locked",
        status: "locked",
        accountId: accountContext.accountId,
        featureKey: VOICE_TRANSCRIPTION_FEATURE_KEY,
        checkedAt: accountContext.checkedAt,
      });
      return;
    }

    const body = await readJsonBody(request);
    const transcriptionRequest = normalizeVoiceTranscriptionRequest(body);
    if (!transcriptionRequest) {
      saveTranscriptionAuditEvent(db, {
        accountId: accountContext.accountId,
        deviceId: accountContext.deviceId,
        result: {
          status: "invalid",
          reason: "invalid_transcription_request",
        },
        checkedAt: accountContext.checkedAt,
      });
      sendJson(response, 400, { error: "invalid_transcription_request" });
      return;
    }

    const usage = db.getFeatureUsage({
      accountId: accountContext.accountId,
      featureKey: VOICE_TRANSCRIPTION_FEATURE_KEY,
      checkedAt: accountContext.checkedAt,
      limit: voiceTranscriptionMonthlyLimit,
    });

    if (!usage || usage.remaining <= 0) {
      saveTranscriptionAuditEvent(db, {
        accountId: accountContext.accountId,
        deviceId: accountContext.deviceId,
        transcriptionRequest,
        result: {
          status: "usage_limit_exceeded",
          reason: "usage_limit_exceeded",
        },
        usage,
        checkedAt: accountContext.checkedAt,
      });
      sendJson(response, 429, {
        error: "usage_limit_exceeded",
        status: "usage_limit_exceeded",
        accountId: accountContext.accountId,
        featureKey: VOICE_TRANSCRIPTION_FEATURE_KEY,
        usage,
        checkedAt: accountContext.checkedAt,
      });
      return;
    }

    const transcriptionStartedAt = Date.now();
    const transcriptionResult = await transcribeVoiceAudio({
      providerConfig: voiceTranscriptionProvider,
      transcriptionRequest,
      checkedAt: accountContext.checkedAt,
      fetchImpl,
    });
    const transcriptionProcessingMs = normalizeTranscriptionEventProcessingMs(Date.now() - transcriptionStartedAt);

    if (transcriptionResult.body?.status !== "transcribed") {
      saveTranscriptionAuditEvent(db, {
        accountId: accountContext.accountId,
        deviceId: accountContext.deviceId,
        transcriptionRequest,
        result: transcriptionResult.body,
        usage,
        processingMs: transcriptionProcessingMs,
        checkedAt: accountContext.checkedAt,
      });
      sendJson(response, transcriptionResult.statusCode, {
        ...transcriptionResult.body,
        accountId: accountContext.accountId,
        featureKey: VOICE_TRANSCRIPTION_FEATURE_KEY,
        usage,
        checkedAt: accountContext.checkedAt,
      });
      return;
    }

    const spentUsage = db.recordFeatureUsage({
      accountId: accountContext.accountId,
      featureKey: VOICE_TRANSCRIPTION_FEATURE_KEY,
      checkedAt: accountContext.checkedAt,
      count: 1,
      limit: voiceTranscriptionMonthlyLimit,
    }) || usage;

    saveTranscriptionAuditEvent(db, {
      accountId: accountContext.accountId,
      deviceId: accountContext.deviceId,
      transcriptionRequest,
      result: transcriptionResult.body,
      usage: spentUsage,
      spent: true,
      processingMs: transcriptionProcessingMs,
      checkedAt: accountContext.checkedAt,
    });

    sendJson(response, transcriptionResult.statusCode, {
      ...transcriptionResult.body,
      accountId: accountContext.accountId,
      featureKey: VOICE_TRANSCRIPTION_FEATURE_KEY,
      usage: spentUsage,
      checkedAt: accountContext.checkedAt,
    });
    return;
  }

  if (url.pathname === "/api/sync/checkout") {
    const accountContext = getExistingAccountContext({ request, response, db, now });
    if (!accountContext) return;

    if (request.method !== "POST") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    const body = await readJsonBody(request, { optional: true });
    if (body !== null && !isPlainObject(body)) {
      sendJson(response, 400, { error: "invalid_checkout_request" });
      return;
    }

    const featureKey = normalizePaidFeatureKey(body?.featureKey ?? body?.feature);
    if (!featureKey) {
      sendJson(response, 400, { error: "invalid_paid_feature" });
      return;
    }

    const checkout = await createSubscriptionCheckout({
      checkoutBaseUrl: subscriptionCheckoutUrl,
      yookassaConfig,
      accountId: accountContext.accountId,
      featureKey,
      checkedAt: accountContext.checkedAt,
      createId,
      fetchImpl,
    });

    if (checkout.status === "provider_not_configured") {
      sendJson(response, 503, {
        error: "provider_not_configured",
        ...checkout,
      });
      return;
    }

    sendJson(response, 200, checkout);
    return;
  }

  if (url.pathname === "/api/sync/checkout/status") {
    const accountContext = getExistingAccountContext({ request, response, db, now });
    if (!accountContext) return;

    if (request.method !== "GET") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    const paymentId = normalizeYooKassaPaymentId(url.searchParams.get("paymentId") || url.searchParams.get("payment_id"));
    if (!paymentId) {
      sendJson(response, 400, { error: "invalid_payment_id" });
      return;
    }

    const result = await checkYooKassaPaymentStatus({
      db,
      yookassaConfig,
      accountId: accountContext.accountId,
      paymentId,
      checkedAt: accountContext.checkedAt,
      fetchImpl,
    });

    sendJson(response, result.statusCode, result.body);
    return;
  }

  if (url.pathname === "/api/admin/entitlements") {
    if (!adminToken) {
      sendJson(response, 404, { error: "not_found" });
      return;
    }

    if (!isAuthorizedAdminRequest(request, adminToken)) {
      sendJson(response, 401, { error: "admin_token_required" });
      return;
    }

    if (request.method !== "POST") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    const body = await readJsonBody(request, { optional: true });
    if (!isPlainObject(body)) {
      sendJson(response, 400, { error: "invalid_admin_entitlement_request" });
      return;
    }

    const accountId = String(body.accountId || body.account || "").trim();
    if (!accountId) {
      sendJson(response, 400, { error: "account_required" });
      return;
    }

    if (!db.getAccount(accountId)) {
      sendJson(response, 404, { error: "account_not_found" });
      return;
    }

    const featureKey = normalizePaidFeatureKey(body.featureKey ?? body.feature);
    if (!featureKey) {
      sendJson(response, 400, { error: "invalid_paid_feature" });
      return;
    }

    if (Object.prototype.hasOwnProperty.call(body, "enabled") && typeof body.enabled !== "boolean") {
      sendJson(response, 400, { error: "invalid_entitlement_enabled" });
      return;
    }

    const enabled = body.enabled !== false;
    const checkedAt = now();
    const source = enabled ? sanitizeEntitlementSource(body.source) || "manual" : "none";
    const expiresAt = enabled && body.expiresAt !== undefined ? normalizeTimestamp(body.expiresAt) : null;
    if (enabled && body.expiresAt !== undefined && !expiresAt) {
      sendJson(response, 400, { error: "invalid_entitlement_expires_at" });
      return;
    }

    const entitlements = {
      ...db.getAccountEntitlements(accountId, checkedAt),
      [featureKey]: enabled
        ? {
          enabled: true,
          source,
          updatedAt: checkedAt,
          activatedAt: checkedAt,
          expiresAt,
          paymentId: null,
        }
        : createDefaultAccountEntitlements()[featureKey],
    };
    const savedEntitlements = db.setAccountEntitlements({
      accountId,
      entitlements,
      updatedAt: checkedAt,
    });
    saveEntitlementAuditEvent(db, {
      accountId,
      featureKey,
      origin: "admin",
      status: enabled ? "activated" : "disabled",
      source,
      entitlement: savedEntitlements[featureKey],
      checkedAt,
    });

    sendJson(response, 200, {
      accountId,
      featureKey,
      checkedAt,
      entitlements: savedEntitlements,
    });
    return;
  }

  if (url.pathname === "/api/yookassa/webhook") {
    if (!yookassaWebhookToken) {
      sendJson(response, 404, { error: "not_found" });
      return;
    }

    if (!isAuthorizedYooKassaWebhookRequest({ request, url, yookassaWebhookToken })) {
      sendJson(response, 401, { error: "yookassa_webhook_token_required" });
      return;
    }

    if (request.method !== "POST") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    const body = await readJsonBody(request);
    const eventKey = createYooKassaWebhookEventKey(body);
    const processedEvent = db.getProcessedProviderEvent(eventKey);
    if (processedEvent) {
      const replayResult = createProcessedYooKassaWebhookResponse({
        processedEvent,
        eventKey,
        notification: body,
        checkedAt: now(),
      });
      sendJson(response, replayResult.statusCode, replayResult.body);
      return;
    }

    const checkedAt = now();
    const result = applyYooKassaWebhookNotification({
      db,
      notification: body,
      checkedAt,
      yookassaConfig,
    });
    saveProcessedYooKassaWebhookEvent({
      db,
      eventKey,
      notification: body,
      result,
      checkedAt,
    });
    sendJson(response, result.statusCode, result.body);
    return;
  }

  if (url.pathname === "/api/sync/devices/current") {
    const accountContext = getExistingAccountContext({ request, response, db, now, touch: false });
    if (!accountContext) return;

    if (request.method !== "DELETE") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    const removedDeviceSessions = db.removeDeviceSession({
      accountId: accountContext.accountId,
      deviceId: accountContext.deviceId,
    });
    const removedPushSubscriptions = db.removePushSubscriptionsForDevice({
      accountId: accountContext.accountId,
      deviceId: accountContext.deviceId,
    });

    sendJson(response, 200, {
      disconnected: true,
      accountId: accountContext.accountId,
      deviceId: accountContext.deviceId,
      removedDeviceSessions,
      removedPushSubscriptions,
    });
    return;
  }

  if (url.pathname === "/api/sync/schedules") {
    const accountContext = getExistingAccountContext({ request, response, db, now });
    if (!accountContext) return;

    if (request.method === "GET") {
      sendJson(response, 200, getScheduleSnapshot(db, accountContext.accountId));
      return;
    }

    if (request.method === "PUT") {
      const body = await readJsonBody(request);
      if (!Array.isArray(body?.schedules)) {
        sendJson(response, 400, { error: "invalid_schedules" });
        return;
      }

      const snapshot = saveScheduleSnapshot(db, {
        accountId: accountContext.accountId,
        schedules: body.schedules,
        updatedAt: now(),
      });
      sendJson(response, 200, snapshot);
      return;
    }

    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  if (url.pathname === "/api/sync/reminders") {
    const accountContext = getExistingAccountContext({ request, response, db, now });
    if (!accountContext) return;

    if (request.method === "GET") {
      sendJson(response, 200, getReminderSnapshot(db, accountContext.accountId));
      return;
    }

    if (request.method === "PUT") {
      const body = await readJsonBody(request);
      if (!Array.isArray(body?.reminders)) {
        sendJson(response, 400, { error: "invalid_reminders" });
        return;
      }

      const snapshot = saveReminderSnapshot(db, {
        accountId: accountContext.accountId,
        reminders: body.reminders,
        updatedAt: now(),
      });
      sendJson(response, 200, snapshot);
      return;
    }

    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  if (url.pathname === "/api/sync/tasks") {
    const accountContext = getExistingAccountContext({ request, response, db, now });
    if (!accountContext) return;

    if (request.method === "GET") {
      sendJson(response, 200, getTaskSnapshot(db, accountContext.accountId));
      return;
    }

    if (request.method === "PUT") {
      const body = await readJsonBody(request);
      if (!Array.isArray(body?.tasks)) {
        sendJson(response, 400, { error: "invalid_tasks" });
        return;
      }

      const snapshot = saveTaskSnapshot(db, {
        accountId: accountContext.accountId,
        tasks: body.tasks,
        updatedAt: now(),
      });
      sendJson(response, 200, snapshot);
      return;
    }

    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  if (url.pathname === "/api/sync/notes") {
    const accountContext = getExistingAccountContext({ request, response, db, now });
    if (!accountContext) return;

    if (request.method === "GET") {
      sendJson(response, 200, getNoteSnapshot(db, accountContext.accountId));
      return;
    }

    if (request.method === "PUT") {
      const body = await readJsonBody(request);
      if (!Array.isArray(body?.notes)) {
        sendJson(response, 400, { error: "invalid_notes" });
        return;
      }

      const snapshot = saveNoteSnapshot(db, {
        accountId: accountContext.accountId,
        notes: body.notes,
        updatedAt: now(),
      });
      sendJson(response, 200, snapshot);
      return;
    }

    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  if (url.pathname === "/api/sync/birthdays") {
    const accountContext = getExistingAccountContext({ request, response, db, now });
    if (!accountContext) return;

    if (request.method === "GET") {
      sendJson(response, 200, getBirthdaySnapshot(db, accountContext.accountId));
      return;
    }

    if (request.method === "PUT") {
      const body = await readJsonBody(request);
      if (!Array.isArray(body?.birthdays)) {
        sendJson(response, 400, { error: "invalid_birthdays" });
        return;
      }

      const snapshot = saveBirthdaySnapshot(db, {
        accountId: accountContext.accountId,
        birthdays: body.birthdays,
        updatedAt: now(),
      });
      sendJson(response, 200, snapshot);
      return;
    }

    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  if (url.pathname === "/api/sync/diary") {
    const accountContext = getExistingAccountContext({ request, response, db, now });
    if (!accountContext) return;

    if (request.method === "GET") {
      sendJson(response, 200, getDiarySnapshot(db, accountContext.accountId));
      return;
    }

    if (request.method === "PUT") {
      const body = await readJsonBody(request);
      if (!Array.isArray(body?.entries)) {
        sendJson(response, 400, { error: "invalid_diary_entries" });
        return;
      }

      const snapshot = saveDiarySnapshot(db, {
        accountId: accountContext.accountId,
        entries: body.entries,
        updatedAt: now(),
      });
      sendJson(response, 200, snapshot);
      return;
    }

    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  if (url.pathname === "/api/push/subscriptions") {
    const accountContext = getExistingAccountContext({ request, response, db, now });
    if (!accountContext) return;

    if (request.method !== "PUT") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    const body = await readJsonBody(request);
    const subscription = normalizePushSubscription(body?.subscription);
    if (!subscription) {
      sendJson(response, 400, { error: "invalid_push_subscription" });
      return;
    }

    db.savePushSubscription({
      accountId: accountContext.accountId,
      deviceId: accountContext.deviceId,
      subscription,
      updatedAt: now(),
    });
    sendJson(response, 200, {
      saved: true,
      subscriptions: db.getPushSubscriptions(accountContext.accountId).length,
    });
    return;
  }

  sendJson(response, 404, { error: "not_found" });
}

function getAuthSessionResponse({ request, authConfig, authSessions }) {
  const session = getAuthSession(request, authSessions);

  return {
    configured: isAuthConfigured(authConfig),
    issuer: authConfig.issuer,
    redirectUri: authConfig.redirectUri,
    scope: authConfig.scope,
    authenticated: Boolean(session),
    accountId: session?.accountId || null,
    user: session?.user || null,
  };
}

async function startAuthLogin({ request, response, url, authConfig, createId }) {
  if (!isAuthConfigured(authConfig)) {
    sendJson(response, 503, {
      error: "auth_not_configured",
      issuer: authConfig.issuer,
      redirectUri: authConfig.redirectUri,
    });
    return;
  }

  const codeVerifier = createAuthToken(createId);
  const state = createAuthToken(createId);
  const nonce = createAuthToken(createId);
  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));
  const authorizationUrl = new URL(authConfig.authorizationEndpoint);

  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", authConfig.clientId);
  authorizationUrl.searchParams.set("redirect_uri", authConfig.redirectUri);
  authorizationUrl.searchParams.set("scope", authConfig.scope);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("nonce", nonce);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");
  authorizationUrl.searchParams.set("code_challenge", createCodeChallenge(codeVerifier));

  sendRedirect(response, authorizationUrl.href, [
    buildCookie(AUTH_TRANSIENT_COOKIE, encodeJsonCookie({ codeVerifier, state, nonce, returnTo }), {
      maxAge: AUTH_TRANSIENT_MAX_AGE_SECONDS,
      secure: isSecureRequest(request),
    }),
  ]);
}

async function finishAuthLogin({ request, response, url, db, authConfig, authSessions, createId, now, fetchImpl }) {
  if (!isAuthConfigured(authConfig)) {
    sendJson(response, 503, { error: "auth_not_configured" });
    return;
  }

  const cookies = parseCookies(request.headers.cookie || "");
  const transient = decodeJsonCookie(cookies[AUTH_TRANSIENT_COOKIE]);
  const code = url.searchParams.get("code") || "";
  const returnedState = url.searchParams.get("state") || "";
  const authError = url.searchParams.get("error") || "";

  if (authError) {
    sendJson(response, 400, { error: "auth_provider_error" });
    return;
  }

  if (!isPlainObject(transient) || !transient.codeVerifier || !transient.state || transient.state !== returnedState || !code) {
    sendJson(response, 400, { error: "auth_state_invalid" });
    return;
  }

  const tokenSet = await exchangeAuthCode({ authConfig, code, codeVerifier: transient.codeVerifier, fetchImpl });
  const user = await loadAuthUser({ authConfig, accessToken: tokenSet.access_token, fetchImpl });
  const safeUser = sanitizeAuthUser(user);
  const accountId = createOrbitAccountId(authConfig.issuer, safeUser.sub);
  const sessionId = createAuthToken(createId);
  const createdAt = now();

  if (!db.getAccount(accountId)) {
    db.createAccount({
      accountId,
      displayName: safeUser.name || safeUser.email || safeUser.preferredUsername || null,
      createdAt,
    });
  }

  authSessions.set(sessionId, {
    sessionId,
    accountId,
    user: safeUser,
    createdAt,
    expiresAt: new Date(Date.parse(createdAt) + AUTH_SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
  });

  sendRedirect(response, transient.returnTo || "/", [
    buildCookie(AUTH_SESSION_COOKIE, sessionId, {
      maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
      secure: isSecureRequest(request),
    }),
    buildCookie(AUTH_TRANSIENT_COOKIE, "", {
      maxAge: 0,
      secure: isSecureRequest(request),
    }),
  ]);
}

function logoutAuthSession({ request, response, authSessions }) {
  const cookies = parseCookies(request.headers.cookie || "");
  const sessionId = cookies[AUTH_SESSION_COOKIE];
  if (sessionId) {
    authSessions.delete(sessionId);
  }

  sendJson(response, 200, { authenticated: false }, {
    "set-cookie": buildCookie(AUTH_SESSION_COOKIE, "", {
      maxAge: 0,
      secure: isSecureRequest(request),
    }),
  });
}

async function exchangeAuthCode({ authConfig, code, codeVerifier, fetchImpl }) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: authConfig.clientId,
    redirect_uri: authConfig.redirectUri,
    code,
    code_verifier: codeVerifier,
  });

  if (authConfig.clientSecret) {
    body.set("client_secret", authConfig.clientSecret);
  }

  const response = await fetchImpl(authConfig.tokenEndpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error("Orbit Auth token exchange failed.");
  }

  const tokenSet = await response.json();
  if (typeof tokenSet.access_token !== "string" || !tokenSet.access_token) {
    throw new Error("Orbit Auth token response is missing an access token.");
  }

  return tokenSet;
}

async function loadAuthUser({ authConfig, accessToken, fetchImpl }) {
  const response = await fetchImpl(authConfig.userinfoEndpoint, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Orbit Auth userinfo request failed.");
  }

  return response.json();
}

function getAuthSession(request, authSessions) {
  const cookies = parseCookies(request.headers.cookie || "");
  const sessionId = cookies[AUTH_SESSION_COOKIE];
  const session = sessionId ? authSessions.get(sessionId) : null;

  if (!session) return null;

  if (session.expiresAt && Date.parse(session.expiresAt) <= Date.now()) {
    authSessions.delete(sessionId);
    return null;
  }

  return session;
}

function getAccountId(request) {
  const accountId = String(request.headers["x-focus-account"] || "").trim();
  if (!/^[a-zA-Z0-9_.:-]{8,160}$/.test(accountId)) {
    return "";
  }
  return accountId;
}

function getDeviceId(request) {
  const deviceId = String(request.headers["x-focus-device"] || "").trim();
  return /^[a-zA-Z0-9_.:-]{4,160}$/.test(deviceId) ? deviceId : "unknown-device";
}

function getDeviceName(request) {
  const rawDeviceName = String(request.headers["x-focus-device-name"] || "").trim();
  if (!rawDeviceName) return "";

  try {
    return sanitizeStoredName(decodeURIComponent(rawDeviceName)) || sanitizeStoredName(rawDeviceName) || "";
  } catch {
    return sanitizeStoredName(rawDeviceName) || "";
  }
}

function getExistingAccountContext({ request, response, db, now, touch = true }) {
  const accountId = getAccountId(request);
  if (!accountId) {
    sendJson(response, 401, { error: "account_required" });
    return null;
  }

  if (!db.getAccount(accountId)) {
    sendJson(response, 404, { error: "account_not_found" });
    return null;
  }

  const deviceId = getDeviceId(request);
  const checkedAt = now();

  if (touch) {
    touchAccount(db, {
      accountId,
      deviceId,
      deviceName: getDeviceName(request),
      now: checkedAt,
    });
  }

  return {
    accountId,
    deviceId,
    checkedAt,
  };
}

function sanitizeStoredName(value) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 120) : null;
}

function normalizeUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.href.replace(/\/$/, "");
  } catch {
    return "";
  }
}

function normalizeMoneyAmount(value) {
  const amount = String(value || "").trim().replace(",", ".");
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(amount)) {
    return "";
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return "";
  }

  return numericAmount.toFixed(2);
}

function normalizeSecretToken(value) {
  const token = String(value || "").trim();
  return token.length >= 16 ? token : "";
}

function getAdminTokenFromRequest(request) {
  const headerToken = String(request.headers["x-focus-admin-token"] || "").trim();
  if (headerToken) {
    return headerToken;
  }

  return getBearerTokenFromRequest(request);
}

function getBearerTokenFromRequest(request) {
  const authorization = String(request.headers.authorization || "").trim();
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function isAuthorizedAdminRequest(request, adminToken) {
  return hasMatchingSecretToken(getAdminTokenFromRequest(request), adminToken);
}

function getYooKassaWebhookTokenFromRequest({ request, url }) {
  const queryToken = String(url.searchParams.get("token") || url.searchParams.get("webhookToken") || "").trim();
  if (queryToken) {
    return queryToken;
  }

  const headerToken = String(request.headers["x-focus-yookassa-token"] || "").trim();
  if (headerToken) {
    return headerToken;
  }

  return getBearerTokenFromRequest(request);
}

function isAuthorizedYooKassaWebhookRequest({ request, url, yookassaWebhookToken }) {
  return hasMatchingSecretToken(getYooKassaWebhookTokenFromRequest({ request, url }), yookassaWebhookToken);
}

function getQuoteCategoriesResponse(db) {
  const catalog = db.getQuoteCatalog();
  const categories = db.getQuoteCategories().map(category => {
    const activeVerifiedCount = catalog.filter(quote => isQuoteEligibleForProduction(quote)
      && quote.categoryCodes.includes(category.code)).length;
    return {
      ...category,
      activeVerifiedCount,
      available: activeVerifiedCount >= category.minimumCatalogSize,
    };
  });

  return {
    selectionModes: [
      {
        code: QUOTE_CATEGORY_ANY_CODE,
        titleRu: "Любые",
      },
    ],
    categories,
  };
}

function getQuotePreferencesResponse(db, { accountId, timezone, checkedAt }) {
  const preferences = getEffectiveQuotePreferences(db, {
    accountId,
    timezone,
    localDate: getLocalDateString(checkedAt, timezone),
    checkedAt,
  });
  return {
    accountId,
    preferences,
    checkedAt,
  };
}

function saveQuotePreferencesFromRequest(db, { accountId, body, timezone, checkedAt }) {
  if (!isPlainObject(body)) {
    return { statusCode: 400, body: { error: "invalid_quote_preferences" } };
  }

  const nextTimezone = normalizeTimezone(body.timezone || timezone);
  const selectionMode = QUOTE_SELECTION_MODES.has(body.selectionMode) ? body.selectionMode : "";
  if (!selectionMode) {
    return { statusCode: 400, body: { error: "invalid_quote_selection_mode" } };
  }

  const activeCategoryCodes = new Set(db.getQuoteCategories()
    .filter(category => category.isActive)
    .map(category => category.code));
  const selectedCategoryCodes = Array.isArray(body.selectedCategoryCodes)
    ? body.selectedCategoryCodes.map(sanitizeQuoteCategoryCode).filter(Boolean)
    : [];
  const uniqueSelectedCodes = [...new Set(selectedCategoryCodes)];

  if (selectionMode === "any" && uniqueSelectedCodes.length > 0) {
    return { statusCode: 400, body: { error: "quote_any_mode_cannot_use_categories" } };
  }

  if (selectionMode === "selected_categories") {
    if (uniqueSelectedCodes.length < 1 || uniqueSelectedCodes.length > 3) {
      return { statusCode: 400, body: { error: "invalid_quote_category_count" } };
    }

    if (uniqueSelectedCodes.some(code => !activeCategoryCodes.has(code))) {
      return { statusCode: 400, body: { error: "invalid_quote_category" } };
    }
  }

  const currentLocalDate = getLocalDateString(checkedAt, nextTimezone);
  const effectiveFromLocalDate = getNextLocalDate(currentLocalDate);
  const saved = db.saveUserQuotePreferences({
    accountId,
    updatedAt: checkedAt,
    preferences: {
      accountId,
      selectionMode,
      selectedCategoryCodes: selectionMode === "selected_categories" ? uniqueSelectedCodes : [],
      timezone: nextTimezone,
      language: QUOTE_LANGUAGE,
      excludeReligiousQuotes: body.excludeReligiousQuotes === true,
      excludePoliticalQuotes: body.excludePoliticalQuotes === true,
      excludeSadQuotes: body.excludeSadQuotes === true,
      effectiveFromLocalDate,
      createdAt: db.getUserQuotePreferences(accountId)?.createdAt || checkedAt,
      updatedAt: checkedAt,
    },
  });

  db.saveQuoteEvent({
    accountId,
    eventType: "quote_preferences_updated",
    localDate: currentLocalDate,
    createdAt: checkedAt,
  });

  return {
    statusCode: 200,
    body: {
      accountId,
      preferences: saved,
      effectiveFromLocalDate,
      message: "Новые настройки начнут действовать завтра в 00:00. Сегодняшняя подборка останется без изменений.",
      checkedAt,
    },
  };
}

function getTodayQuotesResponse(db, { accountId, timezone, checkedAt, createId }) {
  const normalizedTimezone = normalizeTimezone(timezone);
  const localDate = getLocalDateString(checkedAt, normalizedTimezone);
  const existingSet = db.getDailyQuoteSet({ accountId, localDate });
  if (existingSet?.status === "ready") {
    const existingBody = formatTodayQuotesResponse(db, { accountId, set: existingSet });
    if (existingBody.quotes.length === QUOTES_PER_DAY) {
      db.saveQuoteEvent({
        accountId,
        eventType: "daily_quotes_opened",
        localDate,
        generationReason: existingSet.generationReason,
        createdAt: checkedAt,
      });
      return {
        statusCode: 200,
        body: existingBody,
      };
    }
  }

  const generated = generateDailyQuoteSet(db, {
    accountId,
    timezone: normalizedTimezone,
    localDate,
    generationReason: QUOTE_FALLBACK_REASON,
    checkedAt,
    createId,
    force: true,
  });

  if (!generated.ok) {
    db.saveQuoteEvent({
      accountId,
      eventType: "daily_quotes_generation_failed",
      localDate,
      generationReason: QUOTE_FALLBACK_REASON,
      createdAt: checkedAt,
    });
    return {
      statusCode: 503,
      body: {
        error: "quote_catalog_unavailable",
        accountId,
        localDate,
        timezone: normalizedTimezone,
        reason: generated.reason,
        quotes: [],
      },
    };
  }

  db.saveQuoteEvent({
    accountId,
    eventType: "daily_quotes_recovery_used",
    localDate,
    generationReason: QUOTE_FALLBACK_REASON,
    createdAt: checkedAt,
  });
  db.saveQuoteEvent({
    accountId,
    eventType: "daily_quotes_generated",
    localDate,
    generationReason: QUOTE_FALLBACK_REASON,
    createdAt: checkedAt,
  });

  return {
    statusCode: 200,
    body: formatTodayQuotesResponse(db, {
      accountId,
      set: generated.set,
    }),
  };
}

function generateDailyQuoteSet(db, { accountId, timezone, localDate, generationReason, checkedAt, createId, force = false }) {
  const existingSet = db.getDailyQuoteSet({ accountId, localDate });
  if (!force && existingSet?.status === "ready") {
    return { ok: true, set: existingSet, items: db.getDailyQuoteSetItems(existingSet.id) };
  }

  const preferences = getEffectiveQuotePreferences(db, {
    accountId,
    timezone,
    localDate,
    checkedAt,
  });
  const selected = selectDailyQuotes(db, {
    accountId,
    localDate,
    preferences,
  });
  if (selected.quotes.length !== QUOTES_PER_DAY) {
    return {
      ok: false,
      reason: selected.reason || "not_enough_verified_quotes",
    };
  }

  const validFromUtc = getLocalMidnightUtc(localDate, preferences.timezone);
  const validUntilUtc = getLocalMidnightUtc(getNextLocalDate(localDate), preferences.timezone);
  const set = {
    id: createId(),
    accountId,
    localDate,
    timezone: preferences.timezone,
    validFromUtc,
    validUntilUtc,
    generationReason,
    status: "ready",
    createdAt: checkedAt,
  };
  const items = selected.quotes.map((quote, index) => ({
    setId: set.id,
    quoteId: quote.id,
    position: index + 1,
    selectedCategoryCode: selected.categoryCodes[index] || quote.categoryCodes[0] || QUOTE_CATEGORY_ANY_CODE,
    createdAt: checkedAt,
  }));
  const saved = db.saveDailyQuoteSet({ set, items });
  return saved ? { ok: true, ...saved } : { ok: false, reason: "daily_quote_set_save_failed" };
}

function getEffectiveQuotePreferences(db, { accountId, timezone, localDate, checkedAt }) {
  const stored = db.getUserQuotePreferences(accountId);
  const normalizedTimezone = normalizeTimezone(stored?.timezone || timezone);
  const defaultPreferences = normalizeUserQuotePreferences(null, {
    accountId,
    timezone: normalizedTimezone,
    checkedAt,
  });

  if (!stored?.accountId) {
    return defaultPreferences;
  }

  const effectiveFromLocalDate = normalizeLocalDate(stored.effectiveFromLocalDate);
  if (effectiveFromLocalDate && effectiveFromLocalDate > localDate) {
    return {
      ...defaultPreferences,
      timezone: normalizedTimezone,
    };
  }

  return normalizeUserQuotePreferences(stored, {
    accountId,
    timezone: normalizedTimezone,
    checkedAt,
  });
}

function selectDailyQuotes(db, { accountId, localDate, preferences }) {
  const catalog = db.getQuoteCatalog().filter(isQuoteEligibleForProduction);
  if (catalog.length < QUOTES_PER_DAY) {
    return { quotes: [], categoryCodes: [], reason: "not_enough_verified_quotes" };
  }

  const activeCategoryCodes = db.getQuoteCategories()
    .filter(category => category.isActive)
    .map(category => category.code);
  const selectedCategoryCodes = preferences.selectionMode === "selected_categories"
    ? preferences.selectedCategoryCodes.filter(code => activeCategoryCodes.includes(code))
    : [];
  const allocations = createQuoteCategoryAllocations({
    selectionMode: preferences.selectionMode,
    selectedCategoryCodes,
    activeCategoryCodes,
    localDate,
  });

  for (const repeatWindowDays of QUOTE_REPEAT_WINDOWS_DAYS) {
    const recentQuoteIds = repeatWindowDays > 0
      ? new Set(db.listRecentDailyQuoteItems({ accountId, beforeLocalDate: localDate, days: repeatWindowDays }).map(item => item.quoteId))
      : new Set();
    const selected = pickQuotesForAllocations({
      accountId,
      localDate,
      catalog,
      allocations,
      recentQuoteIds,
      allowRepeatedAuthors: false,
    });
    if (selected.quotes.length === QUOTES_PER_DAY) {
      if (repeatWindowDays !== QUOTE_REPEAT_WINDOWS_DAYS[0]) {
        db.saveQuoteEvent({
          accountId,
          eventType: "quote_catalog_fallback_applied",
          localDate,
          generationReason: QUOTE_FALLBACK_REASON,
          createdAt: new Date().toISOString(),
        });
      }
      return selected;
    }

    const relaxedAuthors = pickQuotesForAllocations({
      accountId,
      localDate,
      catalog,
      allocations,
      recentQuoteIds,
      allowRepeatedAuthors: true,
    });
    if (relaxedAuthors.quotes.length === QUOTES_PER_DAY) {
      return relaxedAuthors;
    }
  }

  return { quotes: [], categoryCodes: [], reason: "not_enough_unique_quotes" };
}

function pickQuotesForAllocations({ accountId, localDate, catalog, allocations, recentQuoteIds, allowRepeatedAuthors }) {
  const selected = [];
  const selectedCategoryCodes = [];
  const selectedIds = new Set();
  const selectedAuthors = new Set();

  allocations.forEach((categoryCode, allocationIndex) => {
    const categoryCandidates = catalog
      .filter(quote => categoryCode === QUOTE_CATEGORY_ANY_CODE || quote.categoryCodes.includes(categoryCode));
    const sortedCandidates = sortQuotesDeterministically(categoryCandidates, `${accountId}:${localDate}:${categoryCode}:${allocationIndex}`);
    const quote = sortedCandidates.find(candidate => {
      if (selectedIds.has(candidate.id) || recentQuoteIds.has(candidate.id)) return false;
      if (!allowRepeatedAuthors && selectedAuthors.has(candidate.authorName)) return false;
      return true;
    }) || sortedCandidates.find(candidate => !selectedIds.has(candidate.id) && !recentQuoteIds.has(candidate.id))
      || sortedCandidates.find(candidate => !selectedIds.has(candidate.id));

    if (quote) {
      selected.push(quote);
      selectedCategoryCodes.push(categoryCode === QUOTE_CATEGORY_ANY_CODE ? quote.categoryCodes[0] || QUOTE_CATEGORY_ANY_CODE : categoryCode);
      selectedIds.add(quote.id);
      selectedAuthors.add(quote.authorName);
    }
  });

  if (selected.length < QUOTES_PER_DAY) {
    const fallbackCandidates = sortQuotesDeterministically(catalog, `${accountId}:${localDate}:fallback`);
    fallbackCandidates.forEach(quote => {
      if (selected.length >= QUOTES_PER_DAY || selectedIds.has(quote.id)) return;
      if (recentQuoteIds.has(quote.id)) return;
      if (!allowRepeatedAuthors && selectedAuthors.has(quote.authorName)) return;
      selected.push(quote);
      selectedCategoryCodes.push(quote.categoryCodes[0] || QUOTE_CATEGORY_ANY_CODE);
      selectedIds.add(quote.id);
      selectedAuthors.add(quote.authorName);
    });
  }

  return {
    quotes: selected.slice(0, QUOTES_PER_DAY),
    categoryCodes: selectedCategoryCodes.slice(0, QUOTES_PER_DAY),
  };
}

function createQuoteCategoryAllocations({ selectionMode, selectedCategoryCodes, activeCategoryCodes, localDate }) {
  if (selectionMode !== "selected_categories" || selectedCategoryCodes.length === 0) {
    const rotatedCategories = rotateArray(activeCategoryCodes.length ? activeCategoryCodes : [QUOTE_CATEGORY_ANY_CODE], getLocalDateOrdinal(localDate));
    const allocations = [];
    for (let index = 0; allocations.length < QUOTES_PER_DAY; index += 1) {
      allocations.push(rotatedCategories[index % rotatedCategories.length] || QUOTE_CATEGORY_ANY_CODE);
    }
    return allocations;
  }

  const rotated = rotateArray(selectedCategoryCodes, getLocalDateOrdinal(localDate));
  if (rotated.length === 1) {
    return Array(QUOTES_PER_DAY).fill(rotated[0]);
  }

  if (rotated.length === 2) {
    return [rotated[0], rotated[0], rotated[0], rotated[1], rotated[1]];
  }

  return [rotated[0], rotated[0], rotated[1], rotated[1], rotated[2]];
}

function rotateArray(items, offset) {
  if (!items.length) {
    return [];
  }

  const shift = Math.abs(Number(offset) || 0) % items.length;
  return [...items.slice(shift), ...items.slice(0, shift)];
}

function sortQuotesDeterministically(quotes, seed) {
  return [...quotes].sort((first, second) => {
    const firstHash = createQuoteHash(`${seed}:${first.id}`);
    const secondHash = createQuoteHash(`${seed}:${second.id}`);
    return firstHash.localeCompare(secondHash);
  });
}

function isQuoteEligibleForProduction(quote) {
  return isPlainObject(quote)
    && quote.verificationStatus === QUOTE_VERIFICATION_STATUS
    && quote.isActive === true
    && quote.contentValidation === QUOTE_CONTENT_VALIDATION_PASSED
    && quote.profanityValidation?.status === QUOTE_CONTENT_VALIDATION_PASSED
    && quote.profanityValidation?.code === QUOTE_PROFANITY_NOT_DETECTED
    && quote.rightsStatus !== QUOTE_RIGHTS_BLOCKED_STATUS
    && quote.displayLanguage === QUOTE_LANGUAGE
    && Array.isArray(quote.categoryCodes)
    && quote.categoryCodes.length > 0;
}

function formatTodayQuotesResponse(db, { accountId, set }) {
  const catalogById = new Map(db.getQuoteCatalog().map(quote => [quote.id, quote]));
  const items = db.getDailyQuoteSetItems(set.id);
  return {
    localDate: set.localDate,
    timezone: set.timezone,
    validFromUtc: set.validFromUtc,
    validUntilUtc: set.validUntilUtc,
    generationReason: set.generationReason,
    quotes: items
      .map(item => {
        const quote = catalogById.get(item.quoteId);
        if (!quote || !isQuoteEligibleForProduction(quote)) {
          return null;
        }

        return {
          id: quote.id,
          position: item.position,
          text: quote.text,
          authorName: quote.authorName,
          sourceTitle: quote.sourceTitle,
          sourceType: quote.sourceType,
          sourceReference: quote.sourceReference,
          sourceUrl: quote.sourceUrl || undefined,
          categoryCodes: quote.categoryCodes,
          isFavorite: db.isFavoriteQuote({ accountId, quoteId: quote.id }),
        };
      })
      .filter(Boolean)
      .sort((first, second) => first.position - second.position),
  };
}

function getLocalDateString(timestamp, timezone = QUOTE_DEFAULT_TIMEZONE) {
  const date = new Date(normalizeTimestamp(timestamp) || timestamp || Date.now());
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizeTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getNextLocalDate(localDate) {
  const normalizedDate = normalizeLocalDate(localDate);
  const time = Date.parse(`${normalizedDate}T00:00:00.000Z`);
  if (!Number.isFinite(time)) {
    return getLocalDateString(Date.now(), QUOTE_DEFAULT_TIMEZONE);
  }

  return new Date(time + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function getLocalDateOrdinal(localDate) {
  const time = Date.parse(`${normalizeLocalDate(localDate)}T00:00:00.000Z`);
  return Number.isFinite(time) ? Math.floor(time / (24 * 60 * 60 * 1000)) : 0;
}

function getLocalMidnightUtc(localDate, timezone) {
  const [year, month, day] = normalizeLocalDate(localDate).split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  let utcTime = Date.UTC(year, month - 1, day, 0, 0, 0);
  for (let index = 0; index < 2; index += 1) {
    const offset = getTimezoneOffsetMs(timezone, utcTime);
    utcTime = Date.UTC(year, month - 1, day, 0, 0, 0) - offset;
  }
  return new Date(utcTime).toISOString();
}

function getTimezoneOffsetMs(timezone, utcTime) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: normalizeTimezone(timezone),
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcTime));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const localAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour === "24" ? "0" : values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return localAsUtc - utcTime;
}

function hasMatchingSecretToken(requestToken, expectedToken) {
  if (!requestToken || !expectedToken) {
    return false;
  }

  const requestBuffer = Buffer.from(requestToken);
  const expectedBuffer = Buffer.from(expectedToken);
  return requestBuffer.length === expectedBuffer.length && timingSafeEqual(requestBuffer, expectedBuffer);
}

function isAuthConfigured(authConfig) {
  return Boolean(authConfig?.issuer && authConfig?.clientId && authConfig?.redirectUri);
}

function createAuthToken(createId) {
  return base64Url(createHash("sha256").update(`${createId()}:${createId()}:${Date.now()}`).digest());
}

function createCodeChallenge(codeVerifier) {
  return base64Url(createHash("sha256").update(codeVerifier).digest());
}

function createOrbitAccountId(issuer, subject) {
  const digest = createHash("sha256").update(`${issuer}:${subject}`).digest("hex").slice(0, 32);
  return `orbit:${digest}`;
}

function sanitizeAuthUser(user) {
  if (!isPlainObject(user) || typeof user.sub !== "string" || !user.sub.trim()) {
    throw new Error("Orbit Auth userinfo response is missing sub.");
  }

  return {
    sub: user.sub,
    email: typeof user.email === "string" ? user.email : null,
    name: typeof user.name === "string" ? user.name : null,
    preferredUsername: typeof user.preferred_username === "string" ? user.preferred_username : null,
    picture: typeof user.picture === "string" ? user.picture : null,
  };
}

function sanitizeReturnTo(value) {
  const fallback = "/";
  if (typeof value !== "string" || !value.trim()) return fallback;

  try {
    const url = new URL(value, "https://focus.local");
    if (url.origin !== "https://focus.local") return fallback;
    if (url.pathname.startsWith("/api/")) return fallback;
    return `${url.pathname}${url.search}${url.hash}` || fallback;
  } catch {
    return fallback;
  }
}

function parseCookies(cookieHeader) {
  return String(cookieHeader || "").split(";").reduce((cookies, item) => {
    const index = item.indexOf("=");
    if (index <= 0) return cookies;
    const name = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
    return cookies;
  }, {});
}

function encodeJsonCookie(value) {
  return base64Url(Buffer.from(JSON.stringify(value), "utf8"));
}

function decodeJsonCookie(value) {
  if (!value) return null;

  try {
    return JSON.parse(Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function base64Url(buffer) {
  return Buffer.from(buffer).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function buildCookie(name, value, { maxAge, secure, httpOnly = true } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "SameSite=Lax"];
  if (Number.isFinite(maxAge)) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  }
  if (httpOnly) {
    parts.push("HttpOnly");
  }
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

function isSecureRequest(request) {
  const forwardedProto = String(request.headers["x-forwarded-proto"] || "").toLowerCase();
  const host = String(request.headers.host || "").toLowerCase();
  return forwardedProto.includes("https") || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
}

function touchAccount(db, { accountId, deviceId, deviceName, now }) {
  db.touchAccount({ accountId, deviceId, deviceName, now });
}

function getAccountProfile(db, { accountId, deviceId }) {
  const account = db.getAccount(accountId) || {
    accountId,
    displayName: null,
    createdAt: null,
    updatedAt: null,
  };

  return {
    accountId,
    displayName: account.displayName || null,
    createdAt: account.createdAt || null,
    updatedAt: account.updatedAt || account.createdAt || null,
    currentDeviceId: deviceId,
    devices: db.listDeviceSessions(accountId).map(session => ({
      deviceId: session.deviceId,
      deviceName: session.deviceName || null,
      firstSeenAt: session.firstSeenAt || session.lastSeenAt || null,
      lastSeenAt: session.lastSeenAt || null,
      isCurrent: session.deviceId === deviceId,
    })),
  };
}

function getAccountEntitlements(db, { accountId, checkedAt }) {
  return {
    accountId,
    checkedAt,
    entitlements: db.getAccountEntitlements(accountId, checkedAt),
    usage: {
      voiceTranscription: db.getFeatureUsage({
        accountId,
        featureKey: VOICE_TRANSCRIPTION_FEATURE_KEY,
        checkedAt,
      }),
    },
  };
}

function getScheduleSnapshot(db, accountId) {
  const snapshot = db.getScheduleSnapshot(accountId);

  if (!snapshot) {
    return {
      accountId,
      revision: 0,
      schedules: [],
      updatedAt: null,
    };
  }

  return {
    accountId,
    revision: snapshot.revision,
    schedules: snapshot.schedules,
    updatedAt: snapshot.updatedAt,
  };
}

function saveScheduleSnapshot(db, { accountId, schedules, updatedAt }) {
  return db.saveScheduleSnapshot({ accountId, schedules, updatedAt });
}

function getReminderSnapshot(db, accountId) {
  const snapshot = db.getReminderSnapshot(accountId);

  if (!snapshot) {
    return {
      accountId,
      revision: 0,
      reminders: [],
      updatedAt: null,
    };
  }

  return {
    accountId,
    revision: snapshot.revision,
    reminders: snapshot.reminders,
    updatedAt: snapshot.updatedAt,
  };
}

function saveReminderSnapshot(db, { accountId, reminders, updatedAt }) {
  return db.saveReminderSnapshot({
    accountId,
    reminders: preserveDeliveredReminderState(db, accountId, reminders),
    updatedAt,
  });
}

function preserveDeliveredReminderState(db, accountId, reminders) {
  const previousReminders = Array.isArray(db.getReminderSnapshot(accountId)?.reminders)
    ? db.getReminderSnapshot(accountId).reminders
    : [];
  const deliveredAtByKey = new Map();

  previousReminders.forEach(reminder => {
    const deliveryKey = getReminderDeliveryKey(reminder);
    if (deliveryKey && reminder?.deliveredAt) {
      deliveredAtByKey.set(deliveryKey, reminder.deliveredAt);
    }
  });

  return reminders.map(reminder => {
    if (!isPlainObject(reminder) || reminder.deliveredAt) {
      return reminder;
    }

    const deliveryKey = getReminderDeliveryKey(reminder);
    if (!deliveryKey) {
      return reminder;
    }

    const deliveredAt = deliveredAtByKey.get(deliveryKey) || db.getPushDelivery?.(accountId, deliveryKey)?.sentAt || null;
    return deliveredAt ? { ...reminder, deliveredAt } : reminder;
  });
}

function getTaskSnapshot(db, accountId) {
  const snapshot = db.getTaskSnapshot(accountId);

  if (!snapshot) {
    return {
      accountId,
      revision: 0,
      tasks: [],
      updatedAt: null,
    };
  }

  return {
    accountId,
    revision: snapshot.revision,
    tasks: snapshot.tasks,
    updatedAt: snapshot.updatedAt,
  };
}

function saveTaskSnapshot(db, { accountId, tasks, updatedAt }) {
  return db.saveTaskSnapshot({ accountId, tasks, updatedAt });
}

function getNoteSnapshot(db, accountId) {
  const snapshot = db.getNoteSnapshot(accountId);

  if (!snapshot) {
    return {
      accountId,
      revision: 0,
      notes: [],
      updatedAt: null,
    };
  }

  return {
    accountId,
    revision: snapshot.revision,
    notes: snapshot.notes,
    updatedAt: snapshot.updatedAt,
  };
}

function saveNoteSnapshot(db, { accountId, notes, updatedAt }) {
  return db.saveNoteSnapshot({ accountId, notes, updatedAt });
}

function getBirthdaySnapshot(db, accountId) {
  const snapshot = db.getBirthdaySnapshot(accountId);

  if (!snapshot) {
    return {
      accountId,
      revision: 0,
      birthdays: [],
      updatedAt: null,
    };
  }

  return {
    accountId,
    revision: snapshot.revision,
    birthdays: snapshot.birthdays,
    updatedAt: snapshot.updatedAt,
  };
}

function saveBirthdaySnapshot(db, { accountId, birthdays, updatedAt }) {
  return db.saveBirthdaySnapshot({ accountId, birthdays, updatedAt });
}

function getDiarySnapshot(db, accountId) {
  const snapshot = db.getDiarySnapshot(accountId);

  if (!snapshot) {
    return {
      accountId,
      revision: 0,
      entries: [],
      updatedAt: null,
    };
  }

  return {
    accountId,
    revision: snapshot.revision,
    entries: snapshot.entries,
    updatedAt: snapshot.updatedAt,
  };
}

function saveDiarySnapshot(db, { accountId, entries, updatedAt }) {
  return db.saveDiarySnapshot({ accountId, entries, updatedAt });
}

function getPushSubscriptionStatus(db, { accountId, deviceId, configured }) {
  const subscriptions = db.getPushSubscriptions(accountId);
  const deviceSubscriptions = subscriptions.filter(subscription => subscription.deviceId === deviceId);
  const updatedAt = deviceSubscriptions
    .map(subscription => subscription.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1) || null;

  return {
    configured,
    accountId,
    deviceId,
    subscriptions: subscriptions.length,
    deviceSubscriptions: deviceSubscriptions.length,
    deviceRegistered: deviceSubscriptions.length > 0,
    updatedAt,
  };
}

function getReminderDeliveryDiagnostics(db, { accountId, now = new Date().toISOString(), maxAgeMs = DEFAULT_PUSH_MAX_AGE_MS } = {}) {
  const snapshot = db.getReminderSnapshot(accountId);
  const reminders = Array.isArray(snapshot?.reminders) ? snapshot.reminders : [];
  const subscriptions = db.getPushSubscriptions(accountId);
  const nowTime = new Date(now).getTime();
  const stats = {
    scanned: 0,
    due: 0,
    noSubscriptions: 0,
    expired: 0,
    pending: 0,
    alreadyDelivered: 0,
    alreadySent: 0,
    retrying: 0,
    retryExhausted: 0,
    invalid: 0,
  };
  const attention = [];
  let next = null;

  if (!Number.isFinite(nowTime)) {
    return {
      status: "invalid-time",
      accountId,
      checkedAt: now,
      subscriptions: subscriptions.length,
      stats,
      attention,
      next,
    };
  }

  reminders.forEach(reminder => {
    stats.scanned += 1;
    const deliveryKey = getReminderDeliveryKey(reminder);
    let state = getReminderDispatchState(reminder, nowTime, maxAgeMs);
    const retry = deliveryKey ? db.getPushRetry(accountId, deliveryKey) : null;
    const failure = deliveryKey ? db.getPushFailure(accountId, deliveryKey) : null;

    if (state === "due" && deliveryKey && db.hasPushDelivery(accountId, deliveryKey)) {
      state = "alreadySent";
    } else if (state === "due" && failure) {
      state = "retryExhausted";
    } else if (state === "due" && isPushRetryWaiting(retry, nowTime)) {
      state = "retrying";
    } else if (state === "due" && subscriptions.length === 0) {
      state = "noSubscriptions";
    }

    stats[state] += 1;

    if (state === "pending") {
      const scheduledAt = new Date(reminder.scheduledAt).getTime();
      if (!next || scheduledAt < new Date(next.scheduledAt).getTime()) {
        next = createReminderDiagnosticItem(reminder, state);
      }
    }

    if (["due", "noSubscriptions", "expired", "invalid", "retrying", "retryExhausted"].includes(state) && attention.length < 5) {
      attention.push(createReminderDiagnosticItem(reminder, state, { retry, failure }));
    }
  });

  return {
    status: "ok",
    accountId,
    checkedAt: now,
    subscriptions: subscriptions.length,
    stats,
    attention,
    next,
    updatedAt: snapshot?.updatedAt || null,
  };
}

function createReminderDiagnosticItem(reminder, state, { retry = null, failure = null } = {}) {
  const item = {
    id: typeof reminder?.id === "string" ? reminder.id : "",
    title: typeof reminder?.title === "string" ? reminder.title.slice(0, 120) : "",
    scheduledAt: typeof reminder?.scheduledAt === "string" ? reminder.scheduledAt : null,
    state,
  };

  if (retry) {
    item.retry = {
      attempts: Number(retry.attempts) || 0,
      maxAttempts: Number(retry.maxAttempts) || 0,
      nextRetryAt: typeof retry.nextRetryAt === "string" ? retry.nextRetryAt : null,
      lastAttemptAt: typeof retry.lastAttemptAt === "string" ? retry.lastAttemptAt : null,
    };
  }

  if (failure) {
    item.failure = {
      attempts: Number(failure.attempts) || 0,
      maxAttempts: Number(failure.maxAttempts) || 0,
      failedAt: typeof failure.failedAt === "string" ? failure.failedAt : null,
    };
  }

  return item;
}

async function dispatchTestPushNotification({ db, accountId, deviceId, pushSender, now = () => new Date().toISOString() }) {
  const deviceSubscriptions = db.getPushSubscriptions(accountId)
    .filter(subscription => subscription.deviceId === deviceId);
  const stats = {
    sent: 0,
    failed: 0,
    removed: 0,
    deviceSubscriptions: deviceSubscriptions.length,
  };

  for (const subscription of deviceSubscriptions) {
    const result = await pushSender({
      subscription,
      payload: createTestPushPayload(),
      ttl: 60,
    });

    if (result?.ok) {
      stats.sent += 1;
      continue;
    }

    stats.failed += 1;
    if (result?.statusCode === 404 || result?.statusCode === 410) {
      db.removePushSubscription({ accountId, endpoint: subscription.endpoint });
      stats.removed += 1;
    }
  }

  db.savePushEvent({
    accountId,
    deviceId,
    type: "test",
    status: stats.sent > 0 ? "sent" : stats.failed > 0 ? "failed" : "empty",
    title: "Тестовое push-уведомление",
    sent: stats.sent,
    failed: stats.failed,
    removed: stats.removed,
    subscriptions: stats.deviceSubscriptions,
    createdAt: now(),
  });

  return stats;
}

export function createWebPushSender({ publicKey, privateKey, subject }) {
  if (!publicKey || !privateKey) {
    return null;
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);

  return async ({ subscription, payload, ttl = DEFAULT_PUSH_TTL_SECONDS }) => {
    try {
      const response = await webPush.sendNotification(subscription, JSON.stringify(payload), { TTL: ttl });
      return { ok: true, statusCode: response?.statusCode || 201 };
    } catch (error) {
      return {
        ok: false,
        statusCode: error?.statusCode || 0,
        error,
      };
    }
  };
}

export async function runBackgroundReminderDispatch({
  logger = console,
  ...dispatchOptions
} = {}) {
  try {
    return await dispatchDueReminders(dispatchOptions);
  } catch (error) {
    logServerError(logger, "Focus reminder dispatch failed.", error);
    return createReminderDispatchStats();
  }
}

export async function dispatchDueReminders({
  db,
  now = () => new Date().toISOString(),
  pushSender,
  ttl = DEFAULT_PUSH_TTL_SECONDS,
  maxAgeMs = DEFAULT_PUSH_MAX_AGE_MS,
  retryDelayMs = DEFAULT_PUSH_RETRY_DELAY_MS,
  retryMaxAttempts = DEFAULT_PUSH_RETRY_MAX_ATTEMPTS,
} = {}) {
  if (!db || !pushSender) {
    return createReminderDispatchStats();
  }

  const snapshots = db.listReminderSnapshots();
  const nowIso = now();
  const nowTime = new Date(nowIso).getTime();
  const stats = createReminderDispatchStats();
  const maxAttempts = normalizeRetryMaxAttempts(retryMaxAttempts);
  const normalizedRetryDelayMs = normalizeRetryDelayMs(retryDelayMs);

  if (!Number.isFinite(nowTime)) {
    return stats;
  }

  for (const snapshot of snapshots) {
    const reminders = Array.isArray(snapshot.reminders) ? snapshot.reminders : [];
    let updatedReminders = reminders;
    let hasDeliveredReminder = false;

    for (const reminder of reminders) {
      stats.scanned += 1;

      const reminderState = getReminderDispatchState(reminder, nowTime, maxAgeMs);
      if (reminderState !== "due") {
        stats[reminderState] += 1;
        continue;
      }

      const deliveryKey = getReminderDeliveryKey(reminder);
      if (!deliveryKey) {
        stats.invalid += 1;
        continue;
      }

      if (db.hasPushDelivery(snapshot.accountId, deliveryKey)) {
        stats.alreadySent += 1;
        continue;
      }

      if (db.hasPushFailure(snapshot.accountId, deliveryKey)) {
        stats.retryExhausted += 1;
        continue;
      }

      const retry = db.getPushRetry(snapshot.accountId, deliveryKey);
      if (isPushRetryWaiting(retry, nowTime)) {
        stats.retrying += 1;
        continue;
      }

      stats.due += 1;

      const subscriptions = db.getPushSubscriptions(snapshot.accountId);
      if (!subscriptions.length) {
        stats.noSubscriptions += 1;
        db.clearPushRetry({ accountId: snapshot.accountId, deliveryKey });
        db.savePushEvent({
          accountId: snapshot.accountId,
          type: "reminder",
          status: "no-subscriptions",
          title: reminder.title,
          reminderId: reminder.id,
          scheduledAt: reminder.scheduledAt,
          sent: 0,
          failed: 0,
          removed: 0,
          subscriptions: 0,
          createdAt: nowIso,
        });
        continue;
      }

      let deliveredCount = 0;
      let failedCount = 0;
      let removedCount = 0;
      let transientFailedCount = 0;
      for (const subscription of subscriptions) {
        let result;
        try {
          result = await pushSender({
            subscription,
            payload: createReminderPushPayload(reminder),
            ttl,
          });
        } catch (error) {
          result = { ok: false, statusCode: 0, error };
        }

        if (result?.ok) {
          deliveredCount += 1;
          stats.sent += 1;
          continue;
        }

        stats.failed += 1;
        failedCount += 1;
        if (isPermanentPushFailure(result)) {
          db.removePushSubscription({ accountId: snapshot.accountId, endpoint: subscription.endpoint });
          stats.removed += 1;
          removedCount += 1;
        } else {
          transientFailedCount += 1;
        }
      }

      const attemptCount = failedCount > 0 || deliveredCount > 0
        ? (Number(retry?.attempts) || 0) + 1
        : 0;
      const activeSubscriptionsAfterRemoval = db.getPushSubscriptions(snapshot.accountId).length;
      let nextRetryAt = null;
      let eventStatus = deliveredCount > 0 ? "sent" : "failed";

      if (deliveredCount > 0) {
        db.clearPushRetry({ accountId: snapshot.accountId, deliveryKey });
      } else if (transientFailedCount > 0 && activeSubscriptionsAfterRemoval > 0) {
        if (attemptCount >= maxAttempts) {
          eventStatus = "retry-exhausted";
          stats.retryExhausted += 1;
          db.savePushFailure({
            accountId: snapshot.accountId,
            deliveryKey,
            reminderId: reminder.id,
            scheduledAt: reminder.scheduledAt,
            attempts: attemptCount,
            maxAttempts,
            failedAt: nowIso,
            failed: failedCount,
            removed: removedCount,
            subscriptions: subscriptions.length,
          });
        } else {
          stats.retrying += 1;
          nextRetryAt = createNextRetryAt(nowIso, normalizedRetryDelayMs);
          db.savePushRetry({
            accountId: snapshot.accountId,
            deliveryKey,
            reminderId: reminder.id,
            scheduledAt: reminder.scheduledAt,
            attempts: attemptCount,
            maxAttempts,
            lastAttemptAt: nowIso,
            nextRetryAt,
            failed: failedCount,
            removed: removedCount,
            subscriptions: subscriptions.length,
          });
        }
      } else {
        db.clearPushRetry({ accountId: snapshot.accountId, deliveryKey });
      }

      db.savePushEvent({
        accountId: snapshot.accountId,
        type: "reminder",
        status: eventStatus,
        title: reminder.title,
        reminderId: reminder.id,
        scheduledAt: reminder.scheduledAt,
        sent: deliveredCount,
        failed: failedCount,
        removed: removedCount,
        subscriptions: subscriptions.length,
        attempts: attemptCount,
        maxAttempts: failedCount > 0 ? maxAttempts : 0,
        nextRetryAt,
        createdAt: nowIso,
      });

      if (deliveredCount > 0) {
        stats.delivered += 1;
        db.savePushDelivery({
          accountId: snapshot.accountId,
          deliveryKey,
          reminderId: reminder.id,
          scheduledAt: reminder.scheduledAt,
          sentAt: nowIso,
          deliveryCount: deliveredCount,
        });
        updatedReminders = updatedReminders.map(item => getReminderDeliveryKey(item) === deliveryKey
          ? { ...item, deliveredAt: nowIso }
          : item);
        hasDeliveredReminder = true;
      }
    }

    if (hasDeliveredReminder) {
      db.saveReminderSnapshot({
        accountId: snapshot.accountId,
        reminders: updatedReminders,
        updatedAt: nowIso,
      });
    }
  }

  return stats;
}

function logServerError(logger, message, error) {
  if (!logger || typeof logger.error !== "function") {
    return;
  }

  try {
    logger.error(message, error);
  } catch {
    // Логирование не должно ронять sync backend.
  }
}

function createReminderDispatchStats() {
  return {
    scanned: 0,
    due: 0,
    sent: 0,
    failed: 0,
    removed: 0,
    delivered: 0,
    noSubscriptions: 0,
    expired: 0,
    pending: 0,
    alreadyDelivered: 0,
    alreadySent: 0,
    retrying: 0,
    retryExhausted: 0,
    invalid: 0,
  };
}

function getReminderDispatchState(reminder, nowTime, maxAgeMs) {
  if (!isPlainObject(reminder) || !reminder.id || !reminder.scheduledAt) {
    return "invalid";
  }

  if (reminder.deliveredAt) {
    return "alreadyDelivered";
  }

  const scheduledAt = new Date(reminder.scheduledAt).getTime();
  if (!Number.isFinite(scheduledAt)) {
    return "invalid";
  }

  if (scheduledAt > nowTime) {
    return "pending";
  }

  if (scheduledAt < nowTime - maxAgeMs) {
    return "expired";
  }

  return "due";
}

function getReminderDeliveryKey(reminder) {
  if (!reminder?.id || !reminder.scheduledAt) {
    return "";
  }

  return `${reminder.id}:${reminder.scheduledAt}`;
}

function isPermanentPushFailure(result) {
  return result?.statusCode === 404 || result?.statusCode === 410;
}

function isPushRetryWaiting(retry, nowTime) {
  if (!retry) {
    return false;
  }
  const nextRetryTime = new Date(retry.nextRetryAt).getTime();
  return Number.isFinite(nextRetryTime) && nextRetryTime > nowTime;
}

function normalizeRetryDelayMs(retryDelayMs) {
  const parsed = Number(retryDelayMs);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_PUSH_RETRY_DELAY_MS;
}

function normalizeRetryMaxAttempts(retryMaxAttempts) {
  const parsed = Math.floor(Number(retryMaxAttempts));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PUSH_RETRY_MAX_ATTEMPTS;
}

function readNonNegativeNumberEnv(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readPositiveIntegerEnv(name, fallback) {
  const parsed = Math.floor(Number(process.env[name]));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createNextRetryAt(nowIso, retryDelayMs) {
  const nowTime = new Date(nowIso).getTime();
  const safeNowTime = Number.isFinite(nowTime) ? nowTime : Date.now();
  return new Date(safeNowTime + retryDelayMs).toISOString();
}

function createReminderPushPayload(reminder) {
  return {
    type: "focus-reminder",
    reminderId: reminder.id,
    title: "Фокус",
    body: String(reminder.title || "Напоминание"),
    tag: `focus-reminder-${reminder.id}`,
    url: "/",
  };
}

function createTestPushPayload() {
  return {
    type: "focus-test",
    title: "Фокус",
    body: "Тестовое push-уведомление работает.",
    tag: "focus-test-push",
    url: "/",
  };
}

function readJsonBody(request, { optional = false } = {}) {
  return new Promise((resolve, reject) => {
    let body = "";
    let bodyBytes = 0;
    let bodyTooLarge = false;

    request.on("data", chunk => {
      if (bodyTooLarge) {
        return;
      }

      bodyBytes += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
      body += chunk;
      if (bodyBytes > MAX_BODY_BYTES) {
        bodyTooLarge = true;
        reject(new HttpRequestError(413, "request_body_too_large", "Request body is too large."));
        request.resume();
      }
    });

    request.on("end", () => {
      if (bodyTooLarge) {
        return;
      }

      if (!body.trim()) {
        resolve(optional ? null : {});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new HttpRequestError(400, "invalid_json", "Request body must be valid JSON."));
      }
    });

    request.on("error", reject);
  });
}

class HttpRequestError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "HttpRequestError";
    this.status = status;
    this.code = code;
  }
}

function isHttpRequestError(error) {
  return error instanceof HttpRequestError &&
    Number.isInteger(error.status) &&
    error.status >= 400 &&
    error.status < 500 &&
    typeof error.code === "string" &&
    Boolean(error.code);
}

function sendJson(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, {
    "access-control-allow-headers": "authorization, content-type, x-focus-account, x-focus-admin-token, x-focus-device, x-focus-device-name, x-focus-yookassa-token",
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    ...extraHeaders,
  });

  response.end(status === 204 ? "" : JSON.stringify(payload));
}

function sendRedirect(response, location, cookies = []) {
  const headers = {
    "cache-control": "no-store",
    location,
  };

  if (cookies.length) {
    headers["set-cookie"] = cookies;
  }

  response.writeHead(302, headers);
  response.end("");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = createSyncDatabase();
  const server = createFocusSyncServer({ db });
  server.listen(DEFAULT_PORT, "127.0.0.1", () => {
    console.log(`Focus sync API listening on http://127.0.0.1:${DEFAULT_PORT}`);
  });
}
