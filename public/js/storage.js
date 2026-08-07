export const DB_NAME = "focus-v2";
export const DB_VERSION = 1;
export const STORE_NAME = "focus-data";
export const SCHEDULES_KEY = "savedSchedules";
export const REMINDERS_KEY = "localReminders";
export const TASKS_KEY = "todayTasks";
export const NOTES_KEY = "focusNotes";
export const BIRTHDAYS_KEY = "focusBirthdays";
export const DIARY_KEY = "focusDiaryEntries";
export const DIARY_PIN_KEY = "focusDiaryPin";
export const QUOTE_CACHE_KEY = "focusDailyQuotesCache";
export const QUOTE_HISTORY_CACHE_KEY = "focusDailyQuoteHistoryCache";
export const QUOTE_FAVORITES_CACHE_KEY = "focusFavoriteQuotesCache";
export const INTERESTING_TODAY_CACHE_KEY = "focusInterestingTodayCache";
export const HOLIDAY_CATALOG_CACHE_KEY = "focusHolidayCatalogCache";
export const HOLIDAY_PREFERENCES_CACHE_KEY = "focusHolidayPreferencesCache";
export const HOLIDAY_RELIGIOUS_PREFERENCES_KEY = "focusHolidayReligiousPreferences";
export const PERSONAL_SCHEDULE_PLANNER_KEY = "focusPersonalSchedulePlanner";
export const LEGACY_SCHEDULES_KEY = "focus-v2-schedules";
export const LEGACY_TASKS_KEY = "focus-v2-tasks";
export const LEGACY_NOTES_KEY = "focus-v2-notes";
export const LEGACY_BIRTHDAYS_KEY = "focus-v2-birthdays";
export const LEGACY_DIARY_KEY = "focus-v2-diary";

export function parseScheduleList(rawValue) {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function createFocusStorage({
  indexedDB = globalThis.indexedDB,
  localStorage = globalThis.localStorage,
} = {}) {
  let databasePromise = null;

  const open = () => {
    if (!indexedDB) {
      return Promise.reject(new Error("IndexedDB is not available."));
    }

    databasePromise ||= openDatabase(indexedDB);
    return databasePromise;
  };

  const getValue = async key => {
    const database = await open();
    return requestToPromise(database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key));
  };

  const putValue = async (key, value) => {
    const database = await open();
    await requestToPromise(database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(value, key));
    return value;
  };

  const removeLegacyValue = key => {
    try {
      localStorage?.removeItem(key);
    } catch {
      // Очистка legacy-ключей выполняется по возможности; основным хранилищем остается IndexedDB.
    }
  };

  return {
    isAvailable() {
      return Boolean(indexedDB);
    },

    async loadSchedules() {
      const schedules = await getValue(SCHEDULES_KEY);
      return Array.isArray(schedules) ? schedules : [];
    },

    async saveSchedules(schedules) {
      const normalizedSchedules = Array.isArray(schedules) ? schedules : [];
      await putValue(SCHEDULES_KEY, normalizedSchedules);
      removeLegacyValue(LEGACY_SCHEDULES_KEY);
      return normalizedSchedules;
    },

    async loadReminders() {
      const reminders = await getValue(REMINDERS_KEY);
      return Array.isArray(reminders) ? reminders : [];
    },

    async saveReminders(reminders) {
      const normalizedReminders = Array.isArray(reminders) ? reminders : [];
      await putValue(REMINDERS_KEY, normalizedReminders);
      removeLegacyValue(REMINDERS_KEY);
      return normalizedReminders;
    },

    async migrateRemindersFromLocalStorage() {
      const indexedReminders = await this.loadReminders();
      if (indexedReminders.length) {
        removeLegacyValue(REMINDERS_KEY);
        return indexedReminders;
      }

      const legacyReminders = parseScheduleList(localStorage?.getItem(REMINDERS_KEY));
      if (!legacyReminders.length) {
        return [];
      }

      await this.saveReminders(legacyReminders);
      removeLegacyValue(REMINDERS_KEY);
      return legacyReminders;
    },

    async loadTasks() {
      const tasks = await getValue(TASKS_KEY);
      return Array.isArray(tasks) ? tasks : [];
    },

    async saveTasks(tasks) {
      const normalizedTasks = Array.isArray(tasks) ? tasks : [];
      await putValue(TASKS_KEY, normalizedTasks);
      removeLegacyValue(LEGACY_TASKS_KEY);
      return normalizedTasks;
    },

    async loadNotes() {
      const notes = await getValue(NOTES_KEY);
      return Array.isArray(notes) ? notes : [];
    },

    async saveNotes(notes) {
      const normalizedNotes = Array.isArray(notes) ? notes : [];
      await putValue(NOTES_KEY, normalizedNotes);
      removeLegacyValue(LEGACY_NOTES_KEY);
      return normalizedNotes;
    },

    async loadBirthdays() {
      const birthdays = await getValue(BIRTHDAYS_KEY);
      return Array.isArray(birthdays) ? birthdays : [];
    },

    async saveBirthdays(birthdays) {
      const normalizedBirthdays = Array.isArray(birthdays) ? birthdays : [];
      await putValue(BIRTHDAYS_KEY, normalizedBirthdays);
      removeLegacyValue(LEGACY_BIRTHDAYS_KEY);
      return normalizedBirthdays;
    },

    async loadDiaryEntries() {
      const entries = await getValue(DIARY_KEY);
      return Array.isArray(entries) ? entries : [];
    },

    async saveDiaryEntries(entries) {
      const normalizedEntries = Array.isArray(entries) ? entries : [];
      await putValue(DIARY_KEY, normalizedEntries);
      removeLegacyValue(LEGACY_DIARY_KEY);
      return normalizedEntries;
    },

    async loadDiaryPinSettings() {
      const settings = await getValue(DIARY_PIN_KEY);
      return settings && typeof settings === "object" && !Array.isArray(settings) ? settings : null;
    },

    async saveDiaryPinSettings(settings) {
      const normalizedSettings = settings && typeof settings === "object" && !Array.isArray(settings)
        ? settings
        : null;
      await putValue(DIARY_PIN_KEY, normalizedSettings);
      removeLegacyValue(DIARY_PIN_KEY);
      return normalizedSettings;
    },

    async loadDailyQuotesCache() {
      const cache = await getValue(QUOTE_CACHE_KEY);
      return cache && typeof cache === "object" && !Array.isArray(cache) ? cache : null;
    },

    async saveDailyQuotesCache(cache) {
      const normalizedCache = cache && typeof cache === "object" && !Array.isArray(cache)
        ? cache
        : null;
      await putValue(QUOTE_CACHE_KEY, normalizedCache);
      return normalizedCache;
    },

    async loadDailyQuoteHistoryCache() {
      const cache = await getValue(QUOTE_HISTORY_CACHE_KEY);
      return cache && typeof cache === "object" && !Array.isArray(cache) ? cache : null;
    },

    async saveDailyQuoteHistoryCache(cache) {
      const normalizedCache = cache && typeof cache === "object" && !Array.isArray(cache)
        ? cache
        : null;
      await putValue(QUOTE_HISTORY_CACHE_KEY, normalizedCache);
      return normalizedCache;
    },

    async loadFavoriteQuotesCache() {
      const cache = await getValue(QUOTE_FAVORITES_CACHE_KEY);
      return cache && typeof cache === "object" && !Array.isArray(cache) ? cache : null;
    },

    async saveFavoriteQuotesCache(cache) {
      const normalizedCache = cache && typeof cache === "object" && !Array.isArray(cache)
        ? cache
        : null;
      await putValue(QUOTE_FAVORITES_CACHE_KEY, normalizedCache);
      return normalizedCache;
    },

    async loadInterestingTodayCache() {
      const cache = await getValue(INTERESTING_TODAY_CACHE_KEY);
      return cache && typeof cache === "object" && !Array.isArray(cache) ? cache : null;
    },

    async saveInterestingTodayCache(cache) {
      const normalizedCache = cache && typeof cache === "object" && !Array.isArray(cache)
        ? cache
        : null;
      await putValue(INTERESTING_TODAY_CACHE_KEY, normalizedCache);
      return normalizedCache;
    },

    async loadHolidayCatalogCache() {
      const cache = await getValue(HOLIDAY_CATALOG_CACHE_KEY);
      return cache && typeof cache === "object" && !Array.isArray(cache) ? cache : null;
    },

    async saveHolidayCatalogCache(cache) {
      const normalizedCache = cache && typeof cache === "object" && !Array.isArray(cache)
        ? cache
        : null;
      await putValue(HOLIDAY_CATALOG_CACHE_KEY, normalizedCache);
      return normalizedCache;
    },

    async loadHolidayPreferencesCache() {
      const preferences = await getValue(HOLIDAY_PREFERENCES_CACHE_KEY);
      return preferences && typeof preferences === "object" && !Array.isArray(preferences) ? preferences : null;
    },

    async saveHolidayPreferencesCache(preferences) {
      const normalizedPreferences = preferences && typeof preferences === "object" && !Array.isArray(preferences)
        ? preferences
        : null;
      await putValue(HOLIDAY_PREFERENCES_CACHE_KEY, normalizedPreferences);
      return normalizedPreferences;
    },

    async loadHolidayReligiousPreferences() {
      const preferences = await getValue(HOLIDAY_RELIGIOUS_PREFERENCES_KEY);
      return preferences && typeof preferences === "object" && !Array.isArray(preferences) ? preferences : null;
    },

    async saveHolidayReligiousPreferences(preferences) {
      const normalizedPreferences = preferences && typeof preferences === "object" && !Array.isArray(preferences)
        ? preferences
        : null;
      await putValue(HOLIDAY_RELIGIOUS_PREFERENCES_KEY, normalizedPreferences);
      return normalizedPreferences;
    },

    async loadPersonalSchedulePlanner() {
      const plannerState = await getValue(PERSONAL_SCHEDULE_PLANNER_KEY);
      return plannerState && typeof plannerState === "object" && !Array.isArray(plannerState) ? plannerState : null;
    },

    async savePersonalSchedulePlanner(plannerState) {
      const normalizedPlannerState = plannerState && typeof plannerState === "object" && !Array.isArray(plannerState)
        ? plannerState
        : null;
      await putValue(PERSONAL_SCHEDULE_PLANNER_KEY, normalizedPlannerState);
      removeLegacyValue(PERSONAL_SCHEDULE_PLANNER_KEY);
      return normalizedPlannerState;
    },

    async migrateSchedulesFromLocalStorage() {
      const indexedSchedules = await this.loadSchedules();
      if (indexedSchedules.length) {
        removeLegacyValue(LEGACY_SCHEDULES_KEY);
        return indexedSchedules;
      }

      const legacySchedules = parseScheduleList(localStorage?.getItem(LEGACY_SCHEDULES_KEY));
      if (!legacySchedules.length) {
        return [];
      }

      await this.saveSchedules(legacySchedules);
      removeLegacyValue(LEGACY_SCHEDULES_KEY);
      return legacySchedules;
    },

    async migrateTasksFromLocalStorage() {
      const indexedTasks = await this.loadTasks();
      if (indexedTasks.length) {
        removeLegacyValue(LEGACY_TASKS_KEY);
        return indexedTasks;
      }

      const legacyTasks = parseScheduleList(localStorage?.getItem(LEGACY_TASKS_KEY));
      if (!legacyTasks.length) {
        return [];
      }

      await this.saveTasks(legacyTasks);
      removeLegacyValue(LEGACY_TASKS_KEY);
      return legacyTasks;
    },

    async migrateNotesFromLocalStorage() {
      const indexedNotes = await this.loadNotes();
      if (indexedNotes.length) {
        removeLegacyValue(LEGACY_NOTES_KEY);
        return indexedNotes;
      }

      const legacyNotes = parseScheduleList(localStorage?.getItem(LEGACY_NOTES_KEY));
      if (!legacyNotes.length) {
        return [];
      }

      await this.saveNotes(legacyNotes);
      removeLegacyValue(LEGACY_NOTES_KEY);
      return legacyNotes;
    },

    async migrateBirthdaysFromLocalStorage() {
      const indexedBirthdays = await this.loadBirthdays();
      if (indexedBirthdays.length) {
        removeLegacyValue(LEGACY_BIRTHDAYS_KEY);
        return indexedBirthdays;
      }

      const legacyBirthdays = parseScheduleList(localStorage?.getItem(LEGACY_BIRTHDAYS_KEY));
      if (!legacyBirthdays.length) {
        return [];
      }

      await this.saveBirthdays(legacyBirthdays);
      removeLegacyValue(LEGACY_BIRTHDAYS_KEY);
      return legacyBirthdays;
    },

    async migrateDiaryEntriesFromLocalStorage() {
      const indexedEntries = await this.loadDiaryEntries();
      if (indexedEntries.length) {
        removeLegacyValue(LEGACY_DIARY_KEY);
        return indexedEntries;
      }

      const legacyEntries = parseScheduleList(localStorage?.getItem(LEGACY_DIARY_KEY));
      if (!legacyEntries.length) {
        return [];
      }

      await this.saveDiaryEntries(legacyEntries);
      removeLegacyValue(LEGACY_DIARY_KEY);
      return legacyEntries;
    },
  };
}

function openDatabase(indexedDB) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = event => {
      resolve(event.target.result);
    };

    request.onerror = event => {
      reject(event.target.error || request.error || new Error("Failed to open IndexedDB."));
    };
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = event => {
      resolve(event.target.result);
    };

    request.onerror = event => {
      reject(event.target.error || request.error || new Error("IndexedDB request failed."));
    };
  });
}
