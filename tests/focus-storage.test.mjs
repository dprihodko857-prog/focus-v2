import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createFocusStorage,
  LEGACY_BIRTHDAYS_KEY,
  LEGACY_DIARY_KEY,
  LEGACY_NOTES_KEY,
  LEGACY_SCHEDULES_KEY,
  LEGACY_TASKS_KEY,
  PERSONAL_SCHEDULE_PLANNER_KEY,
  DIARY_PIN_KEY,
  INTERESTING_TODAY_CACHE_KEY,
  parseScheduleList,
  QUOTE_CACHE_KEY,
  QUOTE_FAVORITES_CACHE_KEY,
  QUOTE_HISTORY_CACHE_KEY,
  REMINDERS_KEY,
} from "../public/js/storage.js";

test("parseScheduleList returns an empty list for invalid saved data", () => {
  assert.deepEqual(parseScheduleList(null), []);
  assert.deepEqual(parseScheduleList("{bad json"), []);
  assert.deepEqual(parseScheduleList(JSON.stringify({ id: "not-a-list" })), []);
});

test("migrateSchedulesFromLocalStorage copies legacy schedules into IndexedDB", async () => {
  const indexedDB = createFakeIndexedDB();
  const legacySchedules = [
    { id: "school", title: "Уроки в школе", role: "participant" },
    { id: "sport", title: "Тренировка", role: "participant" },
  ];
  const localStorage = createMemoryLocalStorage({
    [LEGACY_SCHEDULES_KEY]: JSON.stringify(legacySchedules),
  });
  const storage = createFocusStorage({ indexedDB, localStorage });

  const migrated = await storage.migrateSchedulesFromLocalStorage();
  const loaded = await storage.loadSchedules();

  assert.deepEqual(migrated, legacySchedules);
  assert.deepEqual(loaded, legacySchedules);
  assert.equal(localStorage.getItem(LEGACY_SCHEDULES_KEY), null);
});

test("migrateSchedulesFromLocalStorage removes stale legacy schedules when IndexedDB already has data", async () => {
  const indexedDB = createFakeIndexedDB();
  const indexedSchedules = [{ id: "indexed", title: "Основное расписание" }];
  const localStorage = createMemoryLocalStorage({
    [LEGACY_SCHEDULES_KEY]: JSON.stringify([{ id: "legacy", title: "Старое расписание" }]),
  });
  const storage = createFocusStorage({ indexedDB, localStorage });

  await storage.saveSchedules(indexedSchedules);

  assert.deepEqual(await storage.migrateSchedulesFromLocalStorage(), indexedSchedules);
  assert.equal(localStorage.getItem(LEGACY_SCHEDULES_KEY), null);
});

test("saveSchedules persists and replaces the IndexedDB schedule list", async () => {
  const indexedDB = createFakeIndexedDB();
  const localStorage = createMemoryLocalStorage();
  const storage = createFocusStorage({ indexedDB, localStorage });

  await storage.saveSchedules([{ id: "first", title: "Первое расписание" }]);
  await storage.saveSchedules([{ id: "second", title: "Второе расписание" }]);

  assert.deepEqual(await storage.loadSchedules(), [{ id: "second", title: "Второе расписание" }]);
});

test("saveReminders persists and replaces the IndexedDB reminder list", async () => {
  const indexedDB = createFakeIndexedDB();
  const storage = createFocusStorage({ indexedDB, localStorage: createMemoryLocalStorage() });

  await storage.saveReminders([{ id: "first", title: "Call", storageKey: REMINDERS_KEY }]);
  await storage.saveReminders([{ id: "second", title: "Workout" }]);

  assert.deepEqual(await storage.loadReminders(), [{ id: "second", title: "Workout" }]);
});

test("migrateRemindersFromLocalStorage copies legacy reminders into IndexedDB", async () => {
  const indexedDB = createFakeIndexedDB();
  const legacyReminders = [
    { id: "reminder-1", title: "Call", scheduledAt: "2026-07-11T10:00:00.000Z" },
  ];
  const localStorage = createMemoryLocalStorage({
    [REMINDERS_KEY]: JSON.stringify(legacyReminders),
  });
  const storage = createFocusStorage({ indexedDB, localStorage });

  assert.deepEqual(await storage.migrateRemindersFromLocalStorage(), legacyReminders);
  assert.deepEqual(await storage.loadReminders(), legacyReminders);
  assert.equal(localStorage.getItem(REMINDERS_KEY), null);
});

test("migrateRemindersFromLocalStorage removes stale legacy reminders when IndexedDB already has data", async () => {
  const indexedDB = createFakeIndexedDB();
  const indexedReminders = [
    { id: "indexed-reminder", title: "Indexed", scheduledAt: "2026-07-11T10:00:00.000Z" },
  ];
  const localStorage = createMemoryLocalStorage({
    [REMINDERS_KEY]: JSON.stringify([{ id: "legacy-reminder", title: "Legacy" }]),
  });
  const storage = createFocusStorage({ indexedDB, localStorage });

  await storage.saveReminders(indexedReminders);

  assert.deepEqual(await storage.migrateRemindersFromLocalStorage(), indexedReminders);
  assert.equal(localStorage.getItem(REMINDERS_KEY), null);
});

test("migrateTasksFromLocalStorage copies legacy tasks into IndexedDB", async () => {
  const indexedDB = createFakeIndexedDB();
  const legacyTasks = [
    { id: "task-1", title: "Prepare documents", label: "Work", dateKey: "2026-07-11" },
  ];
  const localStorage = createMemoryLocalStorage({
    [LEGACY_TASKS_KEY]: JSON.stringify(legacyTasks),
  });
  const storage = createFocusStorage({ indexedDB, localStorage });

  assert.deepEqual(await storage.migrateTasksFromLocalStorage(), legacyTasks);
  assert.deepEqual(await storage.loadTasks(), legacyTasks);
  assert.equal(localStorage.getItem(LEGACY_TASKS_KEY), null);
});

test("saveTasks persists and replaces the IndexedDB task list", async () => {
  const indexedDB = createFakeIndexedDB();
  const storage = createFocusStorage({ indexedDB, localStorage: createMemoryLocalStorage() });

  await storage.saveTasks([{ id: "first", title: "First task" }]);
  await storage.saveTasks([{ id: "second", title: "Second task" }]);

  assert.deepEqual(await storage.loadTasks(), [{ id: "second", title: "Second task" }]);
});

test("migrateNotesFromLocalStorage copies legacy notes into IndexedDB", async () => {
  const indexedDB = createFakeIndexedDB();
  const legacyNotes = [
    { id: "note-1", body: "Идея для расписания", createdAt: "2026-07-11T10:00:00.000Z" },
  ];
  const localStorage = createMemoryLocalStorage({
    [LEGACY_NOTES_KEY]: JSON.stringify(legacyNotes),
  });
  const storage = createFocusStorage({ indexedDB, localStorage });

  assert.deepEqual(await storage.migrateNotesFromLocalStorage(), legacyNotes);
  assert.deepEqual(await storage.loadNotes(), legacyNotes);
  assert.equal(localStorage.getItem(LEGACY_NOTES_KEY), null);
});

test("saveNotes persists and replaces the IndexedDB notes list", async () => {
  const indexedDB = createFakeIndexedDB();
  const storage = createFocusStorage({ indexedDB, localStorage: createMemoryLocalStorage() });

  await storage.saveNotes([{ id: "first", body: "First note" }]);
  await storage.saveNotes([{ id: "second", body: "Second note" }]);

  assert.deepEqual(await storage.loadNotes(), [{ id: "second", body: "Second note" }]);
});

test("migrateBirthdaysFromLocalStorage copies legacy birthdays into IndexedDB", async () => {
  const indexedDB = createFakeIndexedDB();
  const legacyBirthdays = [
    { id: "birthday-1", name: "Анна", dateOfBirth: "1990-07-11", reminderEnabled: true },
  ];
  const localStorage = createMemoryLocalStorage({
    [LEGACY_BIRTHDAYS_KEY]: JSON.stringify(legacyBirthdays),
  });
  const storage = createFocusStorage({ indexedDB, localStorage });

  assert.deepEqual(await storage.migrateBirthdaysFromLocalStorage(), legacyBirthdays);
  assert.deepEqual(await storage.loadBirthdays(), legacyBirthdays);
  assert.equal(localStorage.getItem(LEGACY_BIRTHDAYS_KEY), null);
});

test("saveBirthdays persists and replaces the IndexedDB birthdays list", async () => {
  const indexedDB = createFakeIndexedDB();
  const storage = createFocusStorage({ indexedDB, localStorage: createMemoryLocalStorage() });

  await storage.saveBirthdays([{ id: "first", name: "First", dateOfBirth: "1991-01-01" }]);
  await storage.saveBirthdays([{ id: "second", name: "Second", dateOfBirth: "1992-02-02" }]);

  assert.deepEqual(await storage.loadBirthdays(), [{ id: "second", name: "Second", dateOfBirth: "1992-02-02" }]);
});

test("migrateDiaryEntriesFromLocalStorage copies legacy diary entries into IndexedDB", async () => {
  const indexedDB = createFakeIndexedDB();
  const legacyEntries = [
    { id: "diary-1", dateKey: "2026-07-11", heading: "Итоги дня", text: "Спокойный день" },
  ];
  const localStorage = createMemoryLocalStorage({
    [LEGACY_DIARY_KEY]: JSON.stringify(legacyEntries),
  });
  const storage = createFocusStorage({ indexedDB, localStorage });

  assert.deepEqual(await storage.migrateDiaryEntriesFromLocalStorage(), legacyEntries);
  assert.deepEqual(await storage.loadDiaryEntries(), legacyEntries);
  assert.equal(localStorage.getItem(LEGACY_DIARY_KEY), null);
});

test("saveDiaryEntries persists and replaces the IndexedDB diary list", async () => {
  const indexedDB = createFakeIndexedDB();
  const storage = createFocusStorage({ indexedDB, localStorage: createMemoryLocalStorage() });

  await storage.saveDiaryEntries([{ id: "first", dateKey: "2026-07-10", text: "First entry" }]);
  await storage.saveDiaryEntries([{ id: "second", dateKey: "2026-07-11", text: "Second entry" }]);

  assert.deepEqual(await storage.loadDiaryEntries(), [{ id: "second", dateKey: "2026-07-11", text: "Second entry" }]);
});

test("saveDiaryPinSettings persists and clears diary PIN settings", async () => {
  const indexedDB = createFakeIndexedDB();
  const storage = createFocusStorage({ indexedDB, localStorage: createMemoryLocalStorage() });
  const settings = {
    salt: "001122",
    hash: "aabbcc",
    iterations: 120000,
    updatedAt: "2026-07-11T00:00:00.000Z",
  };

  await storage.saveDiaryPinSettings(settings);
  assert.deepEqual(await storage.loadDiaryPinSettings(), settings);

  await storage.saveDiaryPinSettings(null);
  assert.equal(await storage.loadDiaryPinSettings(), null);
});

test("daily quotes cache persists the current server set for offline display", async () => {
  const indexedDB = createFakeIndexedDB();
  const storage = createFocusStorage({ indexedDB, localStorage: createMemoryLocalStorage() });
  const cache = {
    localDate: "2026-08-04",
    timezone: "Europe/Moscow",
    quotes: [{ id: "quote-1", text: "Focus quote" }],
    savedAt: "2026-08-04T09:00:00.000Z",
  };

  await storage.saveDailyQuotesCache(cache);
  assert.deepEqual(await storage.loadDailyQuotesCache(), cache);

  await storage.saveDailyQuotesCache(null);
  assert.equal(await storage.loadDailyQuotesCache(), null);
});

test("daily quote history cache persists shown quote sets by date", async () => {
  const indexedDB = createFakeIndexedDB();
  const storage = createFocusStorage({ indexedDB, localStorage: createMemoryLocalStorage() });
  const cache = {
    days: 14,
    sets: [
      {
        localDate: "2026-08-04",
        timezone: "Europe/Moscow",
        quotes: [{ id: "quote-1", text: "Focus quote", authorName: "Author" }],
      },
    ],
    savedAt: "2026-08-04T09:00:00.000Z",
    storageKey: QUOTE_HISTORY_CACHE_KEY,
  };

  await storage.saveDailyQuoteHistoryCache(cache);
  assert.deepEqual(await storage.loadDailyQuoteHistoryCache(), cache);

  await storage.saveDailyQuoteHistoryCache(null);
  assert.equal(await storage.loadDailyQuoteHistoryCache(), null);
});

test("favorite quotes cache persists local favorite quotes", async () => {
  const indexedDB = createFakeIndexedDB();
  const storage = createFocusStorage({ indexedDB, localStorage: createMemoryLocalStorage() });
  const cache = {
    quotes: [
      {
        id: "quote-1",
        text: "Focus quote",
        authorName: "Author",
        isFavorite: true,
        favoritedAt: "2026-08-04T09:00:00.000Z",
      },
    ],
    savedAt: "2026-08-04T09:00:00.000Z",
    storageKey: QUOTE_FAVORITES_CACHE_KEY,
  };

  await storage.saveFavoriteQuotesCache(cache);
  assert.deepEqual(await storage.loadFavoriteQuotesCache(), cache);

  await storage.saveFavoriteQuotesCache(null);
  assert.equal(await storage.loadFavoriteQuotesCache(), null);
});

test("interesting today cache persists the current server set for offline display", async () => {
  const indexedDB = createFakeIndexedDB();
  const storage = createFocusStorage({ indexedDB, localStorage: createMemoryLocalStorage() });
  const cache = {
    localDate: "2026-08-05",
    timezone: "Europe/Moscow",
    countryCode: "RU",
    events: [{ id: "it-event-1", title: "Историческое событие" }],
    people: [{ id: "it-person-1", title: "Известный человек" }],
    savedAt: "2026-08-05T09:00:00.000Z",
    storageKey: INTERESTING_TODAY_CACHE_KEY,
  };

  await storage.saveInterestingTodayCache(cache);
  assert.deepEqual(await storage.loadInterestingTodayCache(), cache);

  await storage.saveInterestingTodayCache(null);
  assert.equal(await storage.loadInterestingTodayCache(), null);
});

test("personal schedule planner state persists in IndexedDB", async () => {
  const indexedDB = createFakeIndexedDB();
  const localStorage = createMemoryLocalStorage({
    [PERSONAL_SCHEDULE_PLANNER_KEY]: JSON.stringify({ status: "legacy" }),
  });
  const storage = createFocusStorage({ indexedDB, localStorage });
  const plannerState = {
    schemaVersion: 1,
    status: "draft_ready",
    promptVersion: "personal-schedule-planner@2026-08-04.v1",
    drafts: [{ id: "draft-1" }],
  };

  await storage.savePersonalSchedulePlanner(plannerState);

  assert.deepEqual(await storage.loadPersonalSchedulePlanner(), plannerState);
  assert.equal(localStorage.getItem(PERSONAL_SCHEDULE_PLANNER_KEY), null);

  await storage.savePersonalSchedulePlanner(null);
  assert.equal(await storage.loadPersonalSchedulePlanner(), null);
});

test("successful IndexedDB saves remove stale legacy fallback keys", async () => {
  const indexedDB = createFakeIndexedDB();
  const localStorage = createMemoryLocalStorage({
    [LEGACY_SCHEDULES_KEY]: JSON.stringify([{ id: "legacy-schedule" }]),
    [REMINDERS_KEY]: JSON.stringify([{ id: "legacy-reminder" }]),
    [LEGACY_TASKS_KEY]: JSON.stringify([{ id: "legacy-task" }]),
    [LEGACY_NOTES_KEY]: JSON.stringify([{ id: "legacy-note" }]),
    [LEGACY_BIRTHDAYS_KEY]: JSON.stringify([{ id: "legacy-birthday" }]),
    [LEGACY_DIARY_KEY]: JSON.stringify([{ id: "legacy-diary" }]),
    [DIARY_PIN_KEY]: JSON.stringify({ salt: "old", hash: "old", iterations: 1 }),
    [QUOTE_CACHE_KEY]: JSON.stringify({ localDate: "legacy" }),
  });
  const storage = createFocusStorage({ indexedDB, localStorage });

  await storage.saveSchedules([{ id: "schedule" }]);
  await storage.saveReminders([{ id: "reminder" }]);
  await storage.saveTasks([{ id: "task" }]);
  await storage.saveNotes([{ id: "note" }]);
  await storage.saveBirthdays([{ id: "birthday" }]);
  await storage.saveDiaryEntries([{ id: "diary" }]);
  await storage.saveDiaryPinSettings({
    salt: "001122",
    hash: "aabbcc",
    iterations: 120000,
    updatedAt: "2026-07-11T00:00:00.000Z",
  });

  assert.equal(localStorage.getItem(LEGACY_SCHEDULES_KEY), null);
  assert.equal(localStorage.getItem(REMINDERS_KEY), null);
  assert.equal(localStorage.getItem(LEGACY_TASKS_KEY), null);
  assert.equal(localStorage.getItem(LEGACY_NOTES_KEY), null);
  assert.equal(localStorage.getItem(LEGACY_BIRTHDAYS_KEY), null);
  assert.equal(localStorage.getItem(LEGACY_DIARY_KEY), null);
  assert.equal(localStorage.getItem(DIARY_PIN_KEY), null);
});

function createMemoryLocalStorage(initialValues = {}) {
  const data = new Map(Object.entries(initialValues));

  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    removeItem(key) {
      data.delete(key);
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
  };
}

function createFakeIndexedDB() {
  const databases = new Map();

  return {
    open(name, version) {
      const request = createRequest();

      queueMicrotask(() => {
        let record = databases.get(name);
        const needsUpgrade = !record || record.version < version;

        if (!record) {
          record = {
            stores: new Map(),
            version,
          };
          databases.set(name, record);
        }

        const database = createFakeDatabase(record);
        request.result = database;

        if (needsUpgrade) {
          request.onupgradeneeded?.({ target: request });
          record.version = version;
        }

        request.onsuccess?.({ target: request });
      });

      return request;
    },
  };
}

function createFakeDatabase(record) {
  return {
    objectStoreNames: {
      contains(name) {
        return record.stores.has(name);
      },
    },
    createObjectStore(name) {
      if (!record.stores.has(name)) {
        record.stores.set(name, new Map());
      }
    },
    transaction(storeName) {
      return {
        objectStore() {
          if (!record.stores.has(storeName)) {
            record.stores.set(storeName, new Map());
          }

          const store = record.stores.get(storeName);

          return {
            get(key) {
              const request = createRequest();
              queueMicrotask(() => {
                request.result = store.get(key);
                request.onsuccess?.({ target: request });
              });
              return request;
            },
            put(value, key) {
              const request = createRequest();
              queueMicrotask(() => {
                store.set(key, value);
                request.result = key;
                request.onsuccess?.({ target: request });
              });
              return request;
            },
          };
        },
      };
    },
  };
}

function createRequest() {
  return {
    error: null,
    onerror: null,
    onsuccess: null,
    onupgradeneeded: null,
    result: undefined,
  };
}
