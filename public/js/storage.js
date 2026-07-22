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
      return normalizedSchedules;
    },

    async loadReminders() {
      const reminders = await getValue(REMINDERS_KEY);
      return Array.isArray(reminders) ? reminders : [];
    },

    async saveReminders(reminders) {
      const normalizedReminders = Array.isArray(reminders) ? reminders : [];
      await putValue(REMINDERS_KEY, normalizedReminders);
      return normalizedReminders;
    },

    async loadTasks() {
      const tasks = await getValue(TASKS_KEY);
      return Array.isArray(tasks) ? tasks : [];
    },

    async saveTasks(tasks) {
      const normalizedTasks = Array.isArray(tasks) ? tasks : [];
      await putValue(TASKS_KEY, normalizedTasks);
      return normalizedTasks;
    },

    async loadNotes() {
      const notes = await getValue(NOTES_KEY);
      return Array.isArray(notes) ? notes : [];
    },

    async saveNotes(notes) {
      const normalizedNotes = Array.isArray(notes) ? notes : [];
      await putValue(NOTES_KEY, normalizedNotes);
      return normalizedNotes;
    },

    async loadBirthdays() {
      const birthdays = await getValue(BIRTHDAYS_KEY);
      return Array.isArray(birthdays) ? birthdays : [];
    },

    async saveBirthdays(birthdays) {
      const normalizedBirthdays = Array.isArray(birthdays) ? birthdays : [];
      await putValue(BIRTHDAYS_KEY, normalizedBirthdays);
      return normalizedBirthdays;
    },

    async loadDiaryEntries() {
      const entries = await getValue(DIARY_KEY);
      return Array.isArray(entries) ? entries : [];
    },

    async saveDiaryEntries(entries) {
      const normalizedEntries = Array.isArray(entries) ? entries : [];
      await putValue(DIARY_KEY, normalizedEntries);
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
      return normalizedSettings;
    },

    async migrateSchedulesFromLocalStorage() {
      const indexedSchedules = await this.loadSchedules();
      if (indexedSchedules.length) {
        return indexedSchedules;
      }

      const legacySchedules = parseScheduleList(localStorage?.getItem(LEGACY_SCHEDULES_KEY));
      if (!legacySchedules.length) {
        return [];
      }

      await this.saveSchedules(legacySchedules);
      return legacySchedules;
    },

    async migrateTasksFromLocalStorage() {
      const indexedTasks = await this.loadTasks();
      if (indexedTasks.length) {
        return indexedTasks;
      }

      const legacyTasks = parseScheduleList(localStorage?.getItem(LEGACY_TASKS_KEY));
      if (!legacyTasks.length) {
        return [];
      }

      await this.saveTasks(legacyTasks);
      return legacyTasks;
    },

    async migrateNotesFromLocalStorage() {
      const indexedNotes = await this.loadNotes();
      if (indexedNotes.length) {
        return indexedNotes;
      }

      const legacyNotes = parseScheduleList(localStorage?.getItem(LEGACY_NOTES_KEY));
      if (!legacyNotes.length) {
        return [];
      }

      await this.saveNotes(legacyNotes);
      return legacyNotes;
    },

    async migrateBirthdaysFromLocalStorage() {
      const indexedBirthdays = await this.loadBirthdays();
      if (indexedBirthdays.length) {
        return indexedBirthdays;
      }

      const legacyBirthdays = parseScheduleList(localStorage?.getItem(LEGACY_BIRTHDAYS_KEY));
      if (!legacyBirthdays.length) {
        return [];
      }

      await this.saveBirthdays(legacyBirthdays);
      return legacyBirthdays;
    },

    async migrateDiaryEntriesFromLocalStorage() {
      const indexedEntries = await this.loadDiaryEntries();
      if (indexedEntries.length) {
        return indexedEntries;
      }

      const legacyEntries = parseScheduleList(localStorage?.getItem(LEGACY_DIARY_KEY));
      if (!legacyEntries.length) {
        return [];
      }

      await this.saveDiaryEntries(legacyEntries);
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
