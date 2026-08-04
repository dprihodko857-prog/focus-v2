import assert from "node:assert/strict";
import { test } from "node:test";

import { createFocusSyncClient } from "../public/js/sync.js";

test("getAccountId reuses one account creation request across concurrent sync calls", async () => {
  let accountCreateCalls = 0;
  let resolveAccountCreation = null;
  const accountCreation = new Promise(resolve => {
    resolveAccountCreation = resolve;
  });
  const storage = createMemoryLocalStorage();
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      if (url === "/api/sync/accounts" && options.method === "POST") {
        accountCreateCalls += 1;
        await accountCreation;
        return jsonResponse({ accountId: "account-shared" }, 201);
      }

      throw new Error(`Unexpected request: ${url}`);
    },
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  const firstAccount = client.getAccountId();
  const secondAccount = client.getAccountId();
  resolveAccountCreation();

  assert.deepEqual(await Promise.all([firstAccount, secondAccount]), ["account-shared", "account-shared"]);
  assert.equal(accountCreateCalls, 1);
  assert.equal(storage.getItem("focus-sync-account-id"), "account-shared");
});

test("getAccountId retries account creation after a failed request", async () => {
  let accountCreateCalls = 0;
  const storage = createMemoryLocalStorage();
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      if (url === "/api/sync/accounts" && options.method === "POST") {
        accountCreateCalls += 1;
        return accountCreateCalls === 1
          ? jsonResponse({ error: "temporary" }, 503)
          : jsonResponse({ accountId: "account-retry" }, 201);
      }

      throw new Error(`Unexpected request: ${url}`);
    },
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  await assert.rejects(client.getAccountId(), /account creation failed/);

  assert.equal(await client.getAccountId(), "account-retry");
  assert.equal(accountCreateCalls, 2);
  assert.equal(storage.getItem("focus-sync-account-id"), "account-retry");
});

test("sync state stays stable in memory when localStorage is unavailable", async () => {
  let accountCreateCalls = 0;
  let deviceIdsCreated = 0;
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      if (url === "/api/sync/accounts" && options.method === "POST") {
        accountCreateCalls += 1;
        return jsonResponse({ accountId: "account-memory" }, 201);
      }

      throw new Error(`Unexpected request: ${url}`);
    },
    localStorage: createUnavailableLocalStorage(),
    navigator: { platform: "", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" },
    randomUUID: () => `device-${++deviceIdsCreated}`,
  });

  assert.equal(client.getDeviceId(), "device-1");
  assert.equal(client.getDeviceId(), "device-1");
  assert.equal(client.peekDeviceName(), "iPhone");
  assert.equal(client.peekDeviceName(), "iPhone");
  assert.equal(await client.getAccountId(), "account-memory");
  assert.equal(await client.getAccountId(), "account-memory");
  assert.equal(accountCreateCalls, 1);

  client.setAccountId("shared-account-123");
  assert.equal(client.peekAccountId(), "shared-account-123");
  client.clearAccountId();
  assert.equal(client.peekAccountId(), "");
  assert.equal(client.getDeviceId(), "device-1");
});

test("syncSchedules pushes local schedules when the remote account is empty", async () => {
  const calls = [];
  const storage = createMemoryLocalStorage({ "focus-sync-account-id": "account-1" });
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      if (options.method === "PUT") {
        return jsonResponse({ revision: 1, schedules: JSON.parse(options.body).schedules, updatedAt: "2026-07-10T00:00:00.000Z" });
      }
      return jsonResponse({ revision: 0, schedules: [], updatedAt: null });
    },
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  const schedules = [{ id: "school", title: "School" }];
  const result = await client.syncSchedules(schedules);

  assert.deepEqual(result.schedules, schedules);
  assert.equal(result.status, "pushed");
  assert.equal(storage.getItem("focus-sync-revision"), "1");
  assert.equal(calls[1].options.method, "PUT");
});

test("syncSchedules pulls newer remote schedules into the local list", async () => {
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "account-1",
    "focus-sync-revision": "1",
  });
  const remoteSchedules = [{ id: "sport", title: "Training" }];
  const client = createFocusSyncClient({
    fetch: async () => jsonResponse({ revision: 2, schedules: remoteSchedules, updatedAt: "2026-07-10T00:00:00.000Z" }),
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  const result = await client.syncSchedules([{ id: "school", title: "School" }]);

  assert.deepEqual(result.schedules, remoteSchedules);
  assert.equal(result.status, "pulled");
  assert.equal(storage.getItem("focus-sync-revision"), "2");
});

test("pushSchedules keeps local data when the sync API is unavailable", async () => {
  const client = createFocusSyncClient({
    fetch: async () => {
      throw new Error("offline");
    },
    localStorage: createMemoryLocalStorage({ "focus-sync-account-id": "account-1" }),
    randomUUID: () => "device-1",
  });

  const schedules = [{ id: "school", title: "School" }];
  const result = await client.pushSchedules(schedules);

  assert.deepEqual(result.schedules, schedules);
  assert.equal(result.status, "offline");
});

test("offline schedule pushes are retried before pulling newer remote snapshots", async () => {
  const calls = [];
  let online = false;
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "account-1",
    "focus-sync-revision": "1",
  });
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });

      if (options.method === "PUT") {
        if (!online) {
          throw new Error("offline");
        }

        const schedules = JSON.parse(options.body).schedules;
        return jsonResponse({ revision: 6, schedules, updatedAt: "2026-07-25T00:00:00.000Z" });
      }

      return jsonResponse({
        revision: 5,
        schedules: [{ id: "remote", title: "Remote" }],
        updatedAt: "2026-07-25T00:00:00.000Z",
      });
    },
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  const localSchedules = [{ id: "local", title: "Local" }];

  assert.equal((await client.pushSchedules(localSchedules)).status, "offline");
  assert.match(storage.getItem("focus-sync-pending-collection-pushes"), /schedules/);

  online = true;
  const result = await client.syncSchedules(localSchedules);

  assert.equal(result.status, "pushed");
  assert.deepEqual(result.schedules, localSchedules);
  assert.equal(storage.getItem("focus-sync-pending-collection-pushes"), null);
  assert.equal(storage.getItem("focus-sync-revision"), "6");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, "/api/sync/schedules");
  assert.equal(calls[1].options.method, "PUT");
});

test("failed sync snapshot saves are marked pending for the next recovery", async () => {
  const calls = [];
  let putOnline = false;
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "account-1",
    "focus-sync-revision": "1",
  });
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });

      if (options.method === "PUT") {
        if (!putOnline) {
          throw new Error("put failed");
        }

        const schedules = JSON.parse(options.body).schedules;
        return jsonResponse({ revision: 2, schedules, updatedAt: "2026-07-25T00:00:00.000Z" });
      }

      return jsonResponse({
        revision: 1,
        schedules: [{ id: "existing", title: "Existing" }],
        updatedAt: "2026-07-25T00:00:00.000Z",
      });
    },
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  const localSchedules = [{ id: "local", title: "Local" }];

  assert.equal((await client.syncSchedules(localSchedules)).status, "offline");
  assert.match(storage.getItem("focus-sync-pending-collection-pushes"), /schedules/);

  putOnline = true;
  const result = await client.syncSchedules(localSchedules);

  assert.equal(result.status, "pushed");
  assert.deepEqual(result.schedules, localSchedules);
  assert.equal(storage.getItem("focus-sync-pending-collection-pushes"), null);
  assert.equal(calls.length, 3);
  assert.equal(calls[2].options.method, "PUT");
});

test("pushSchedules serializes concurrent writes so later snapshots cannot be overwritten", async () => {
  const pushedSnapshots = [];
  let releaseFirstPush = null;
  const firstPushStarted = new Promise(resolve => {
    releaseFirstPush = resolve;
  });
  let finishFirstPush = null;
  const firstPushFinished = new Promise(resolve => {
    finishFirstPush = resolve;
  });
  const storage = createMemoryLocalStorage({ "focus-sync-account-id": "account-1" });
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      assert.equal(url, "/api/sync/schedules");
      assert.equal(options.method, "PUT");
      const schedules = JSON.parse(options.body).schedules;
      pushedSnapshots.push(schedules.map(item => item.id));

      if (pushedSnapshots.length === 1) {
        releaseFirstPush();
        await firstPushFinished;
      }

      return jsonResponse({ revision: pushedSnapshots.length, schedules, updatedAt: "2026-07-23T00:00:00.000Z" });
    },
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  const firstPush = client.pushSchedules([{ id: "old", title: "Old" }]);
  const secondPush = client.pushSchedules([{ id: "new", title: "New" }]);

  await firstPushStarted;
  assert.deepEqual(pushedSnapshots, [["old"]]);

  finishFirstPush();
  const results = await Promise.all([firstPush, secondPush]);

  assert.deepEqual(pushedSnapshots, [["old"], ["new"]]);
  assert.equal(results[0].revision, 1);
  assert.equal(results[1].revision, 2);
  assert.equal(storage.getItem("focus-sync-revision"), "2");
});

test("syncReminders pushes local reminders when the remote account is empty", async () => {
  const calls = [];
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      if (options.method === "PUT") {
        return jsonResponse({ revision: 1, reminders: JSON.parse(options.body).reminders, updatedAt: "2026-07-10T00:00:00.000Z" });
      }
      return jsonResponse({ revision: 0, reminders: [], updatedAt: null });
    },
    localStorage: createMemoryLocalStorage({ "focus-sync-account-id": "account-1" }),
    randomUUID: () => "device-1",
  });
  const reminders = [{ id: "reminder-1", title: "Call" }];

  const result = await client.syncReminders(reminders);

  assert.equal(result.status, "pushed");
  assert.deepEqual(result.reminders, reminders);
  assert.equal(calls[0].url, "/api/sync/reminders");
  assert.equal(calls[1].options.method, "PUT");
});

test("syncTasks pulls newer remote tasks into the local list", async () => {
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "account-1",
    "focus-sync-tasks-revision": "1",
  });
  const remoteTasks = [{ id: "task-remote", title: "Remote task", dateKey: "2026-07-11" }];
  const client = createFocusSyncClient({
    fetch: async () => jsonResponse({ revision: 2, tasks: remoteTasks, updatedAt: "2026-07-11T00:00:00.000Z" }),
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  const result = await client.syncTasks([{ id: "task-local", title: "Local task" }]);

  assert.equal(result.status, "pulled");
  assert.deepEqual(result.tasks, remoteTasks);
  assert.equal(storage.getItem("focus-sync-tasks-revision"), "2");
});

test("pushTasks keeps local data when the sync API is unavailable", async () => {
  const client = createFocusSyncClient({
    fetch: async () => {
      throw new Error("offline");
    },
    localStorage: createMemoryLocalStorage({ "focus-sync-account-id": "account-1" }),
    randomUUID: () => "device-1",
  });

  const tasks = [{ id: "task-1", title: "Write report", dateKey: "2026-07-11" }];
  const result = await client.pushTasks(tasks);

  assert.equal(result.status, "offline");
  assert.deepEqual(result.tasks, tasks);
});

test("syncNotes pushes local notes when the remote account is empty", async () => {
  const calls = [];
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      if (options.method === "PUT") {
        return jsonResponse({ revision: 1, notes: JSON.parse(options.body).notes, updatedAt: "2026-07-11T00:00:00.000Z" });
      }
      return jsonResponse({ revision: 0, notes: [], updatedAt: null });
    },
    localStorage: createMemoryLocalStorage({ "focus-sync-account-id": "account-1" }),
    randomUUID: () => "device-1",
  });
  const notes = [{ id: "note-1", body: "Idea" }];

  const result = await client.syncNotes(notes);

  assert.equal(result.status, "pushed");
  assert.deepEqual(result.notes, notes);
  assert.equal(calls[0].url, "/api/sync/notes");
  assert.equal(calls[1].options.method, "PUT");
});

test("pushNotes keeps local data when the sync API is unavailable", async () => {
  const client = createFocusSyncClient({
    fetch: async () => {
      throw new Error("offline");
    },
    localStorage: createMemoryLocalStorage({ "focus-sync-account-id": "account-1" }),
    randomUUID: () => "device-1",
  });

  const notes = [{ id: "note-1", body: "Local note" }];
  const result = await client.pushNotes(notes);

  assert.equal(result.status, "offline");
  assert.deepEqual(result.notes, notes);
});

test("syncBirthdays pushes local birthdays when the remote account is empty", async () => {
  const calls = [];
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      if (options.method === "PUT") {
        return jsonResponse({ revision: 1, birthdays: JSON.parse(options.body).birthdays, updatedAt: "2026-07-11T00:00:00.000Z" });
      }
      return jsonResponse({ revision: 0, birthdays: [], updatedAt: null });
    },
    localStorage: createMemoryLocalStorage({ "focus-sync-account-id": "account-1" }),
    randomUUID: () => "device-1",
  });
  const birthdays = [{ id: "birthday-1", name: "Анна", dateOfBirth: "1990-07-11" }];

  const result = await client.syncBirthdays(birthdays);

  assert.equal(result.status, "pushed");
  assert.deepEqual(result.birthdays, birthdays);
  assert.equal(calls[0].url, "/api/sync/birthdays");
  assert.equal(calls[1].options.method, "PUT");
});

test("pushBirthdays keeps local data when the sync API is unavailable", async () => {
  const client = createFocusSyncClient({
    fetch: async () => {
      throw new Error("offline");
    },
    localStorage: createMemoryLocalStorage({ "focus-sync-account-id": "account-1" }),
    randomUUID: () => "device-1",
  });

  const birthdays = [{ id: "birthday-1", name: "Анна", dateOfBirth: "1990-07-11" }];
  const result = await client.pushBirthdays(birthdays);

  assert.equal(result.status, "offline");
  assert.deepEqual(result.birthdays, birthdays);
});

test("syncDiaryEntries pushes local diary entries when the remote account is empty", async () => {
  const calls = [];
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      if (options.method === "PUT") {
        return jsonResponse({ revision: 1, entries: JSON.parse(options.body).entries, updatedAt: "2026-07-11T00:00:00.000Z" });
      }
      return jsonResponse({ revision: 0, entries: [], updatedAt: null });
    },
    localStorage: createMemoryLocalStorage({ "focus-sync-account-id": "account-1" }),
    randomUUID: () => "device-1",
  });
  const entries = [{ id: "diary-1", dateKey: "2026-07-11", text: "Calm focus" }];

  const result = await client.syncDiaryEntries(entries);

  assert.equal(result.status, "pushed");
  assert.deepEqual(result.entries, entries);
  assert.equal(calls[0].url, "/api/sync/diary");
  assert.equal(calls[1].options.method, "PUT");
});

test("pushDiaryEntries keeps local data when the sync API is unavailable", async () => {
  const client = createFocusSyncClient({
    fetch: async () => {
      throw new Error("offline");
    },
    localStorage: createMemoryLocalStorage({ "focus-sync-account-id": "account-1" }),
    randomUUID: () => "device-1",
  });

  const entries = [{ id: "diary-1", dateKey: "2026-07-11", text: "Local diary entry" }];
  const result = await client.pushDiaryEntries(entries);

  assert.equal(result.status, "offline");
  assert.deepEqual(result.entries, entries);
});

test("savePushSubscription sends the subscription with account and device headers", async () => {
  const calls = [];
  const subscription = { endpoint: "https://push.example/1", keys: { p256dh: "p", auth: "a" } };
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      if (url === "/api/push/config") {
        return jsonResponse({ configured: true, publicKey: "public-key" });
      }
      return jsonResponse({ saved: true, subscriptions: 1 });
    },
    localStorage: createMemoryLocalStorage({ "focus-sync-account-id": "account-1" }),
    randomUUID: () => "device-1",
  });

  assert.deepEqual(await client.getPushConfig(), { configured: true, publicKey: "public-key" });
  assert.deepEqual(await client.savePushSubscription(subscription), { status: "saved", subscriptions: 1 });
  assert.equal(calls[1].url, "/api/push/subscriptions");
  assert.equal(calls[1].options.method, "PUT");
  assert.equal(calls[1].options.headers["x-focus-account"], "account-1");
  assert.equal(calls[1].options.headers["x-focus-device"], "device-1");
  assert.deepEqual(JSON.parse(calls[1].options.body), { subscription });
});

test("getPushSubscriptionStatus loads current device diagnostics", async () => {
  const calls = [];
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      return jsonResponse({
        configured: true,
        accountId: "account-1",
        deviceId: "device-1",
        subscriptions: 2,
        deviceSubscriptions: 1,
        deviceRegistered: true,
        updatedAt: "2026-07-10T10:00:00.000Z",
      });
    },
    localStorage: createMemoryLocalStorage({ "focus-sync-account-id": "account-1" }),
    randomUUID: () => "device-1",
  });

  assert.deepEqual(await client.getPushSubscriptionStatus(), {
    status: "ok",
    configured: true,
    accountId: "account-1",
    deviceId: "device-1",
    subscriptions: 2,
    deviceSubscriptions: 1,
    deviceRegistered: true,
    updatedAt: "2026-07-10T10:00:00.000Z",
  });
  assert.equal(calls[0].url, "/api/push/subscriptions/status");
  assert.equal(calls[0].options.headers["x-focus-account"], "account-1");
  assert.equal(calls[0].options.headers["x-focus-device"], "device-1");
});

test("getReminderDeliveryStatus loads reminder delivery diagnostics", async () => {
  const calls = [];
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      return jsonResponse({
        status: "ok",
        accountId: "account-1",
        checkedAt: "2026-07-10T10:00:00.000Z",
        subscriptions: 1,
        stats: {
          scanned: 2,
          due: 1,
          noSubscriptions: 0,
          expired: 0,
          pending: 1,
          alreadyDelivered: 0,
          alreadySent: 0,
          retrying: 0,
          retryExhausted: 0,
          invalid: 0,
        },
        attention: [{ id: "reminder-1", title: "Call", scheduledAt: "2026-07-10T09:59:00.000Z", state: "due" }],
        next: { id: "reminder-2", title: "Workout", scheduledAt: "2026-07-10T10:30:00.000Z", state: "pending" },
        updatedAt: "2026-07-10T09:00:00.000Z",
      });
    },
    localStorage: createMemoryLocalStorage({ "focus-sync-account-id": "account-1" }),
    randomUUID: () => "device-1",
  });

  assert.deepEqual(await client.getReminderDeliveryStatus(), {
    status: "ok",
    accountId: "account-1",
    checkedAt: "2026-07-10T10:00:00.000Z",
    subscriptions: 1,
    stats: {
      scanned: 2,
      due: 1,
      noSubscriptions: 0,
      expired: 0,
      pending: 1,
      alreadyDelivered: 0,
      alreadySent: 0,
      retrying: 0,
      retryExhausted: 0,
      invalid: 0,
    },
    attention: [{ id: "reminder-1", title: "Call", scheduledAt: "2026-07-10T09:59:00.000Z", state: "due" }],
    next: { id: "reminder-2", title: "Workout", scheduledAt: "2026-07-10T10:30:00.000Z", state: "pending" },
    updatedAt: "2026-07-10T09:00:00.000Z",
  });
  assert.equal(calls[0].url, "/api/push/reminders/status");
  assert.equal(calls[0].options.headers["x-focus-account"], "account-1");
  assert.equal(calls[0].options.headers["x-focus-device"], "device-1");
});

test("getPushEvents loads recent server push delivery events", async () => {
  const calls = [];
  const event = {
    id: "event-1",
    type: "test",
    status: "sent",
    title: "Тестовое push-уведомление",
    sent: 1,
    failed: 0,
    removed: 0,
    createdAt: "2026-07-10T10:00:00.000Z",
  };
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      return jsonResponse({ accountId: "account-1", events: [event] });
    },
    localStorage: createMemoryLocalStorage({ "focus-sync-account-id": "account-1" }),
    randomUUID: () => "device-1",
  });

  assert.deepEqual(await client.getPushEvents(), {
    status: "ok",
    events: [event],
  });
  assert.equal(calls[0].url, "/api/push/events");
  assert.equal(calls[0].options.headers["x-focus-account"], "account-1");
  assert.equal(calls[0].options.headers["x-focus-device"], "device-1");
});

test("sendTestPushNotification requests a server push for the current device", async () => {
  const calls = [];
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      return jsonResponse({ sent: 1, failed: 0, removed: 0, deviceSubscriptions: 1 });
    },
    localStorage: createMemoryLocalStorage({ "focus-sync-account-id": "account-1" }),
    randomUUID: () => "device-1",
  });

  assert.deepEqual(await client.sendTestPushNotification(), {
    status: "sent",
    sent: 1,
    failed: 0,
    removed: 0,
    deviceSubscriptions: 1,
  });
  assert.equal(calls[0].url, "/api/push/test");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["x-focus-account"], "account-1");
  assert.equal(calls[0].options.headers["x-focus-device"], "device-1");
});

test("daily quotes client loads today's server set with account headers", async () => {
  const calls = [];
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "account-1",
    "focus-sync-device-id": "device-1",
  });
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      return jsonResponse({
        localDate: "2026-08-04",
        timezone: "Europe/Moscow",
        validFromUtc: "2026-08-03T21:00:00.000Z",
        validUntilUtc: "2026-08-04T21:00:00.000Z",
        generationReason: "recovery_fallback",
        quotes: [{
          id: "quote-1",
          position: 1,
          text: "Focus quote",
          authorName: "Author",
          sourceTitle: "Book",
          sourceType: "book",
          sourceReference: "chapter 1",
          categoryCodes: ["life_wisdom"],
          isFavorite: false,
        }],
      });
    },
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  const result = await client.getTodayQuotes({ timezone: "Europe/Moscow" });

  assert.equal(result.status, "ok");
  assert.equal(result.localDate, "2026-08-04");
  assert.equal(result.quotes.length, 1);
  assert.equal(result.quotes[0].id, "quote-1");
  assert.equal(calls[0].url, "/api/quotes/today?timezone=Europe%2FMoscow");
  assert.equal(calls[0].options.headers["x-focus-account"], "account-1");
  assert.equal(calls[0].options.headers["x-focus-device"], "device-1");
});

test("daily quotes client reports catalog unavailable without clearing local UI state", async () => {
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "account-1",
    "focus-sync-device-id": "device-1",
  });
  const client = createFocusSyncClient({
    fetch: async () => jsonResponse({
      error: "quote_catalog_unavailable",
      localDate: "2026-08-04",
      timezone: "Europe/Moscow",
      quotes: [],
    }, 503),
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  const result = await client.getTodayQuotes({ timezone: "Europe/Moscow" });

  assert.equal(result.status, "catalog-unavailable");
  assert.equal(result.localDate, "2026-08-04");
  assert.deepEqual(result.quotes, []);
});

test("daily quotes preferences save selected categories for the next local day", async () => {
  const calls = [];
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "account-1",
    "focus-sync-device-id": "device-1",
  });
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      return jsonResponse({
        accountId: "account-1",
        effectiveFromLocalDate: "2026-08-05",
        message: "Новые настройки начнут действовать завтра в 00:00.",
        checkedAt: "2026-08-04T09:00:00.000Z",
        preferences: JSON.parse(options.body),
      });
    },
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  const result = await client.updateQuotePreferences({
    selectionMode: "selected_categories",
    selectedCategoryCodes: ["life_wisdom", "business", "family_children"],
    timezone: "Europe/Moscow",
  });

  assert.equal(result.status, "saved");
  assert.equal(result.effectiveFromLocalDate, "2026-08-05");
  assert.deepEqual(result.preferences.selectedCategoryCodes, ["life_wisdom", "business", "family_children"]);
  assert.equal(calls[0].url, "/api/quotes/preferences");
  assert.equal(calls[0].options.method, "PUT");
  assert.equal(calls[0].options.headers["x-focus-account"], "account-1");
});

test("daily quotes client toggles favorite quotes", async () => {
  const calls = [];
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "account-1",
    "focus-sync-device-id": "device-1",
  });
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      return jsonResponse({
        quoteId: "quote-1",
        isFavorite: options.method === "POST",
        createdAt: "2026-08-04T09:00:00.000Z",
      });
    },
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  assert.deepEqual(await client.favoriteQuote("quote-1"), {
    status: "saved",
    quoteId: "quote-1",
    isFavorite: true,
    createdAt: "2026-08-04T09:00:00.000Z",
  });
  assert.deepEqual(await client.unfavoriteQuote("quote-1"), {
    status: "saved",
    quoteId: "quote-1",
    isFavorite: false,
  });
  assert.equal(calls[0].url, "/api/quotes/quote-1/favorite");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[1].options.method, "DELETE");
});

test("account profile loads and updates device metadata", async () => {
  const calls = [];
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "account-1",
    "focus-sync-device-name": "iPhone Григория",
  });
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      if (options.method === "PATCH") {
        const body = JSON.parse(options.body);
        return jsonResponse({
          accountId: "account-1",
          displayName: body.displayName,
          currentDeviceId: "device-1",
          devices: [{
            deviceId: "device-1",
            deviceName: body.deviceName,
            firstSeenAt: "2026-07-12T08:00:00.000Z",
            lastSeenAt: "2026-07-12T08:05:00.000Z",
            isCurrent: true,
          }],
        });
      }

      return jsonResponse({
        accountId: "account-1",
        displayName: "Личный",
        currentDeviceId: "device-1",
        devices: [{
          deviceId: "device-1",
          deviceName: "iPhone Григория",
          firstSeenAt: "2026-07-12T08:00:00.000Z",
          lastSeenAt: "2026-07-12T08:00:00.000Z",
          isCurrent: true,
        }],
      });
    },
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  const profile = await client.getAccountProfile();
  assert.equal(profile.status, "ok");
  assert.equal(profile.devices[0].deviceName, "iPhone Григория");
  assert.equal(calls[0].url, "/api/sync/account");
  assert.equal(calls[0].options.headers["x-focus-device"], "device-1");
  assert.equal(calls[0].options.headers["x-focus-device-name"], encodeURIComponent("iPhone Григория"));

  const updated = await client.updateAccountProfile({
    displayName: "Личный фокус",
    deviceName: "Ноутбук",
  });

  assert.equal(updated.status, "ok");
  assert.equal(updated.displayName, "Личный фокус");
  assert.equal(updated.devices[0].deviceName, "Ноутбук");
  assert.equal(storage.getItem("focus-sync-device-name"), "Ноутбук");
  assert.equal(calls[1].url, "/api/sync/account");
  assert.equal(calls[1].options.method, "PATCH");
  assert.equal(calls[1].options.headers["x-focus-device-name"], encodeURIComponent("Ноутбук"));
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    displayName: "Личный фокус",
    deviceName: "Ноутбук",
  });
});

test("account profile update queues offline changes and flushes them later", async () => {
  const calls = [];
  let online = false;
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "account-1",
    "focus-sync-device-id": "device-1",
    "focus-sync-device-name": "iPhone Григория",
  });
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      if (!online) {
        throw new Error("offline");
      }

      const body = JSON.parse(options.body);
      return jsonResponse({
        accountId: "account-1",
        displayName: body.displayName,
        currentDeviceId: "device-1",
        devices: [{
          deviceId: "device-1",
          deviceName: body.deviceName,
          firstSeenAt: "2026-07-12T08:00:00.000Z",
          lastSeenAt: "2026-07-12T08:10:00.000Z",
          isCurrent: true,
        }],
      });
    },
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  const offline = await client.updateAccountProfile({
    displayName: "Личный фокус",
    deviceName: "Ноутбук",
  });

  assert.equal(offline.status, "offline");
  assert.equal(offline.displayName, "Личный фокус");
  assert.equal(offline.devices[0].deviceName, "Ноутбук");
  assert.match(storage.getItem("focus-sync-pending-account-profile"), /Личный фокус/);
  assert.equal(storage.getItem("focus-sync-device-name"), "Ноутбук");

  online = true;
  const flushed = await client.flushPendingAccountProfileUpdate();

  assert.equal(flushed.status, "saved");
  assert.equal(flushed.displayName, "Личный фокус");
  assert.equal(flushed.devices[0].deviceName, "Ноутбук");
  assert.equal(storage.getItem("focus-sync-pending-account-profile"), null);
  assert.equal(calls[1].url, "/api/sync/account");
  assert.equal(calls[1].options.method, "PATCH");
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    displayName: "Личный фокус",
    deviceName: "Ноутбук",
  });
});

test("account entitlements load paid feature access", async () => {
  const calls = [];
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "account-1",
    "focus-sync-device-id": "device-1",
  });
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      return jsonResponse({
        accountId: "account-1",
        checkedAt: "2026-07-12T09:00:00.000Z",
        entitlements: {
          voiceTranscription: {
            enabled: true,
            source: "subscription",
            updatedAt: "2026-07-12T08:55:00.000Z",
          },
        },
        usage: {
          voiceTranscription: {
            period: "2026-07",
            used: 7,
            limit: 300,
            remaining: 293,
            resetAt: "2026-08-01T00:00:00.000Z",
            updatedAt: "2026-07-12T08:58:00.000Z",
          },
        },
      });
    },
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  const result = await client.getAccountEntitlements();

  assert.equal(result.status, "ok");
  assert.equal(result.accountId, "account-1");
  assert.equal(result.checkedAt, "2026-07-12T09:00:00.000Z");
  assert.equal(result.entitlements.voiceTranscription.enabled, true);
  assert.equal(result.entitlements.voiceTranscription.source, "subscription");
  assert.deepEqual(result.usage.voiceTranscription, {
    period: "2026-07",
    used: 7,
    limit: 300,
    remaining: 293,
    resetAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-07-12T08:58:00.000Z",
  });
  assert.equal(calls[0].url, "/api/sync/entitlements");
  assert.equal(calls[0].options.headers["x-focus-account"], "account-1");
  assert.equal(calls[0].options.headers["x-focus-device"], "device-1");
});

test("account entitlements default to disabled when offline", async () => {
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "account-1",
    "focus-sync-device-id": "device-1",
  });
  const client = createFocusSyncClient({
    fetch: async () => {
      throw new Error("offline");
    },
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  const result = await client.getAccountEntitlements();

  assert.equal(result.status, "offline");
  assert.equal(result.accountId, "account-1");
  assert.deepEqual(result.entitlements, {
    voiceTranscription: {
      enabled: false,
      source: "none",
      updatedAt: null,
      activatedAt: null,
      expiresAt: null,
      paymentId: null,
    },
  });
  assert.deepEqual(result.usage, {
    voiceTranscription: null,
  });
});

test("entitlement events load account access audit entries", async () => {
  const calls = [];
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "account-1",
    "focus-sync-device-id": "device-1",
  });
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      return jsonResponse({
        accountId: "account-1",
        events: [{
          id: "event-1",
          featureKey: "voiceTranscription",
          origin: "yookassa-webhook",
          status: "activated",
          source: "yookassa",
          paymentId: "payment-client-event-123",
          expiresAt: "2026-08-11T09:00:00.000Z",
          createdAt: "2026-07-12T09:00:00.000Z",
        }],
      });
    },
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  const result = await client.getEntitlementEvents();

  assert.equal(result.status, "ok");
  assert.equal(result.accountId, "account-1");
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].origin, "yookassa-webhook");
  assert.equal(result.events[0].paymentId, "payment-client-event-123");
  assert.equal(calls[0].url, "/api/sync/entitlements/events");
  assert.equal(calls[0].options.headers["x-focus-account"], "account-1");
  assert.equal(calls[0].options.headers["x-focus-device"], "device-1");
});

test("transcription events load account diagnostics entries", async () => {
  const calls = [];
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "account-1",
    "focus-sync-device-id": "device-1",
  });
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      return jsonResponse({
        accountId: "account-1",
        events: [{
          id: "transcription-event-1",
          status: "provider_not_configured",
          provider: "disabled",
          reason: "provider_not_configured",
          mimeType: "audio/webm",
          durationMs: 12345,
          processingMs: 876,
          language: "ru-RU",
          textLength: 0,
          spent: false,
          usage: {
            period: "2026-07",
            used: 0,
            limit: 30,
            remaining: 30,
            resetAt: "2026-08-01T00:00:00.000Z",
          },
          createdAt: "2026-07-31T10:00:00.000Z",
        }],
      });
    },
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  const result = await client.getTranscriptionEvents();

  assert.equal(result.status, "ok");
  assert.equal(result.accountId, "account-1");
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].status, "provider_not_configured");
  assert.equal(result.events[0].reason, "provider_not_configured");
  assert.equal(result.events[0].durationMs, 12345);
  assert.equal(result.events[0].processingMs, 876);
  assert.equal(calls[0].url, "/api/sync/transcription/events");
  assert.equal(calls[0].options.headers["x-focus-account"], "account-1");
  assert.equal(calls[0].options.headers["x-focus-device"], "device-1");
});

test("transcription status loads provider readiness diagnostics", async () => {
  const calls = [];
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "account-1",
    "focus-sync-device-id": "device-1",
  });
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      return jsonResponse({
        accountId: "account-1",
        featureKey: "voiceTranscription",
        providerConfigured: true,
        provider: "localEcho",
        providerModel: "local-model",
        providerTimeoutMs: 45000,
        monthlyLimit: 30,
        maxDurationMs: 60000,
        checkedAt: "2026-07-31T10:00:00.000Z",
      });
    },
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  const result = await client.getTranscriptionStatus();

  assert.equal(result.status, "ok");
  assert.equal(result.accountId, "account-1");
  assert.equal(result.featureKey, "voiceTranscription");
  assert.equal(result.providerConfigured, true);
  assert.equal(result.provider, "localEcho");
  assert.equal(result.providerModel, "local-model");
  assert.equal(result.providerTimeoutMs, 45000);
  assert.equal(result.monthlyLimit, 30);
  assert.equal(result.maxDurationMs, 60000);
  assert.equal(result.checkedAt, "2026-07-31T10:00:00.000Z");
  assert.equal(calls[0].url, "/api/sync/transcription/status");
  assert.equal(calls[0].options.headers["x-focus-account"], "account-1");
  assert.equal(calls[0].options.headers["x-focus-device"], "device-1");
});

test("transcription client handles gated provider scaffold states", async () => {
  const noAccountClient = createFocusSyncClient({
    fetch: async () => {
      throw new Error("No request should be sent without an account.");
    },
    localStorage: createMemoryLocalStorage(),
    randomUUID: () => "device-1",
  });

  assert.deepEqual(await noAccountClient.transcribeAudio({
    audioBase64: "UklGRiQAAABXQVZFZm10IBAAAAABAAEA",
    mimeType: "audio/webm",
  }), {
    status: "account-required",
    accountId: "",
    featureKey: "voiceTranscription",
    text: "",
  });

  const lockedCalls = [];
  const lockedClient = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      lockedCalls.push({ url, options });
      return jsonResponse({
        error: "feature_locked",
        status: "locked",
        accountId: "account-1",
        featureKey: "voiceTranscription",
      }, 402);
    },
    localStorage: createMemoryLocalStorage({
      "focus-sync-account-id": "account-1",
      "focus-sync-device-id": "device-1",
    }),
    randomUUID: () => "device-1",
  });

  const lockedResult = await lockedClient.transcribeAudio({
    audioBase64: "data:audio/webm;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEA",
    mimeType: "audio/webm;codecs=opus",
    durationMs: 12345.9,
    language: "bad language",
    prompt: "  quick   reminder  ",
  });

  assert.deepEqual(lockedResult, {
    status: "locked",
    accountId: "account-1",
    featureKey: "voiceTranscription",
    text: "",
  });
  assert.equal(lockedCalls[0].url, "/api/sync/transcription");
  assert.equal(lockedCalls[0].options.method, "POST");
  assert.equal(lockedCalls[0].options.headers["x-focus-account"], "account-1");
  assert.equal(lockedCalls[0].options.headers["x-focus-device"], "device-1");
  assert.deepEqual(JSON.parse(lockedCalls[0].options.body), {
    audioBase64: "UklGRiQAAABXQVZFZm10IBAAAAABAAEA",
    mimeType: "audio/webm",
    durationMs: 12345,
    language: "ru-RU",
    prompt: "quick reminder",
  });

  const providerClient = createFocusSyncClient({
    fetch: async () => jsonResponse({
      error: "provider_not_configured",
      status: "provider_not_configured",
      accountId: "account-1",
      featureKey: "voiceTranscription",
      provider: null,
      usage: {
        period: "2026-07",
        used: 0,
        limit: 300,
        remaining: 300,
        resetAt: "2026-08-01T00:00:00.000Z",
        updatedAt: null,
      },
    }, 503),
    localStorage: createMemoryLocalStorage({
      "focus-sync-account-id": "account-1",
      "focus-sync-device-id": "device-1",
    }),
    randomUUID: () => "device-1",
  });

  assert.deepEqual(await providerClient.transcribeAudio({
    audioBase64: "UklGRiQAAABXQVZFZm10IBAAAAABAAEA",
    mimeType: "audio/webm",
  }), {
    status: "provider-not-configured",
    accountId: "account-1",
    featureKey: "voiceTranscription",
    provider: null,
    usage: {
      period: "2026-07",
      used: 0,
      limit: 300,
      remaining: 300,
      resetAt: "2026-08-01T00:00:00.000Z",
      updatedAt: null,
    },
    text: "",
  });

  assert.deepEqual(await providerClient.transcribeAudio({
    audioBase64: "bad",
    mimeType: "text/plain",
  }), {
    status: "invalid-request",
    accountId: "account-1",
    featureKey: "voiceTranscription",
    text: "",
  });

  assert.deepEqual(await providerClient.transcribeAudio({
    audioBase64: "UklGRiQAAABXQVZFZm10IBAAAAABAAEA",
    mimeType: "audio/webm",
    durationMs: 120000,
  }), {
    status: "invalid-request",
    accountId: "account-1",
    featureKey: "voiceTranscription",
    text: "",
  });

  const quotaClient = createFocusSyncClient({
    fetch: async () => jsonResponse({
      error: "usage_limit_exceeded",
      status: "usage_limit_exceeded",
      accountId: "account-1",
      featureKey: "voiceTranscription",
      usage: {
        period: "2026-07",
        used: 1,
        limit: 1,
        remaining: 0,
        resetAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-07-12T09:00:00.000Z",
      },
    }, 429),
    localStorage: createMemoryLocalStorage({
      "focus-sync-account-id": "account-1",
      "focus-sync-device-id": "device-1",
    }),
    randomUUID: () => "device-1",
  });

  assert.deepEqual(await quotaClient.transcribeAudio({
    audioBase64: "UklGRiQAAABXQVZFZm10IBAAAAABAAEA",
    mimeType: "audio/webm",
  }), {
    status: "usage-limit-exceeded",
    accountId: "account-1",
    featureKey: "voiceTranscription",
    usage: {
      period: "2026-07",
      used: 1,
      limit: 1,
      remaining: 0,
      resetAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-07-12T09:00:00.000Z",
    },
    text: "",
  });

  const failedClient = createFocusSyncClient({
    fetch: async () => jsonResponse({
      error: "provider_failed",
      status: "failed",
      accountId: "account-1",
      featureKey: "voiceTranscription",
      provider: "openai",
      reason: "provider_timeout",
      usage: {
        period: "2026-07",
        used: 0,
        limit: 1,
        remaining: 1,
        resetAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-07-12T09:00:00.000Z",
      },
    }),
    localStorage: createMemoryLocalStorage({
      "focus-sync-account-id": "account-1",
      "focus-sync-device-id": "device-1",
    }),
    randomUUID: () => "device-1",
  });

  assert.deepEqual(await failedClient.transcribeAudio({
    audioBase64: "UklGRiQAAABXQVZFZm10IBAAAAABAAEA",
    mimeType: "audio/webm",
  }), {
    status: "failed",
    accountId: "account-1",
    featureKey: "voiceTranscription",
    provider: "openai",
    reason: "provider_timeout",
    usage: {
      period: "2026-07",
      used: 0,
      limit: 1,
      remaining: 1,
      resetAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-07-12T09:00:00.000Z",
    },
    text: "",
  });
});

test("subscription checkout loads a configured provider URL", async () => {
  const calls = [];
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "account-1",
    "focus-sync-device-id": "device-1",
  });
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      return jsonResponse({
        status: "ready",
        accountId: "account-1",
        featureKey: "voiceTranscription",
        checkoutUrl: "https://pay.example/checkout?account=account-1&feature=voiceTranscription",
      });
    },
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  const result = await client.createSubscriptionCheckout({ featureKey: "voice_transcription" });

  assert.equal(result.status, "ready");
  assert.equal(result.accountId, "account-1");
  assert.equal(result.featureKey, "voiceTranscription");
  assert.equal(result.checkoutUrl, "https://pay.example/checkout?account=account-1&feature=voiceTranscription");
  assert.equal(calls[0].url, "/api/sync/checkout");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["x-focus-account"], "account-1");
  assert.equal(calls[0].options.headers["x-focus-device"], "device-1");
  assert.deepEqual(JSON.parse(calls[0].options.body), { featureKey: "voiceTranscription" });
});

test("subscription checkout reports missing provider and offline states", async () => {
  const providerStorage = createMemoryLocalStorage({
    "focus-sync-account-id": "account-1",
    "focus-sync-device-id": "device-1",
  });
  const providerClient = createFocusSyncClient({
    fetch: async () => jsonResponse({
      error: "provider_not_configured",
      status: "provider_not_configured",
      accountId: "account-1",
      featureKey: "voiceTranscription",
      checkoutUrl: null,
    }, 503),
    localStorage: providerStorage,
    randomUUID: () => "device-1",
  });

  const providerResult = await providerClient.createSubscriptionCheckout({ featureKey: "voiceTranscription" });

  assert.equal(providerResult.status, "provider-not-configured");
  assert.equal(providerResult.accountId, "account-1");
  assert.equal(providerResult.featureKey, "voiceTranscription");
  assert.equal(providerResult.checkoutUrl, null);

  const offlineClient = createFocusSyncClient({
    fetch: async () => {
      throw new Error("offline");
    },
    localStorage: providerStorage,
    randomUUID: () => "device-1",
  });

  const offlineResult = await offlineClient.createSubscriptionCheckout({ featureKey: "voiceTranscription" });
  assert.equal(offlineResult.status, "offline");
  assert.equal(offlineResult.accountId, "account-1");
  assert.equal(offlineResult.checkoutUrl, null);
});

test("subscription checkout stores and verifies a YooKassa payment", async () => {
  const calls = [];
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "account-1",
    "focus-sync-device-id": "device-1",
  });
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      if (url === "/api/sync/checkout") {
        return jsonResponse({
          status: "ready",
          accountId: "account-1",
          featureKey: "voiceTranscription",
          checkoutUrl: "https://yookassa.test/checkout/payments/v2/contract",
          provider: "yookassa",
          paymentId: "payment-client-status-123",
        });
      }

      return jsonResponse({
        status: "activated",
        accountId: "account-1",
        featureKey: "voiceTranscription",
        provider: "yookassa",
        paymentId: "payment-client-status-123",
        paymentStatus: "succeeded",
        paid: true,
        entitlements: {
          voiceTranscription: {
            enabled: true,
            source: "yookassa",
            updatedAt: "2026-07-12T09:15:00.000Z",
            activatedAt: "2026-07-12T09:15:00.000Z",
            expiresAt: "2026-08-11T09:15:00.000Z",
            paymentId: "payment-client-status-123",
          },
        },
      });
    },
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  const checkout = await client.createSubscriptionCheckout({ featureKey: "voiceTranscription" });
  assert.equal(checkout.status, "ready");
  assert.equal(checkout.provider, "yookassa");
  assert.equal(checkout.paymentId, "payment-client-status-123");
  assert.match(storage.getItem("focus-sync-pending-subscription-checkout"), /payment-client-status-123/);
  assert.deepEqual(client.getPendingSubscriptionCheckout(), {
    accountId: "account-1",
    featureKey: "voiceTranscription",
    provider: "yookassa",
    paymentId: "payment-client-status-123",
    checkoutUrl: "https://yookassa.test/checkout/payments/v2/contract",
    createdAt: client.getPendingSubscriptionCheckout().createdAt,
  });

  const status = await client.getSubscriptionCheckoutStatus();

  assert.equal(status.status, "activated");
  assert.equal(status.paymentStatus, "succeeded");
  assert.equal(status.paid, true);
  assert.deepEqual(status.entitlements, {
    voiceTranscription: {
      enabled: true,
      source: "yookassa",
      updatedAt: "2026-07-12T09:15:00.000Z",
      activatedAt: "2026-07-12T09:15:00.000Z",
      expiresAt: "2026-08-11T09:15:00.000Z",
      paymentId: "payment-client-status-123",
    },
  });
  assert.equal(storage.getItem("focus-sync-pending-subscription-checkout"), null);
  assert.equal(calls[1].url, "/api/sync/checkout/status?paymentId=payment-client-status-123");
  assert.equal(calls[1].options.headers["x-focus-account"], "account-1");
  assert.equal(calls[1].options.headers["x-focus-device"], "device-1");
});

test("subscription checkout status keeps pending YooKassa payments queued", async () => {
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "account-1",
    "focus-sync-device-id": "device-1",
    "focus-sync-pending-subscription-checkout": JSON.stringify({
      accountId: "account-1",
      featureKey: "voiceTranscription",
      provider: "yookassa",
      paymentId: "payment-client-pending-123",
      checkoutUrl: "https://yookassa.test/checkout/payments/v2/contract",
      createdAt: "2026-07-12T09:15:00.000Z",
    }),
  });
  const client = createFocusSyncClient({
    fetch: async () => jsonResponse({
      status: "pending",
      accountId: "account-1",
      featureKey: "voiceTranscription",
      provider: "yookassa",
      paymentId: "payment-client-pending-123",
      paymentStatus: "pending",
      paid: false,
    }),
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  const status = await client.getSubscriptionCheckoutStatus();

  assert.equal(status.status, "pending");
  assert.equal(status.paymentStatus, "pending");
  assert.equal(status.paid, false);
  assert.match(storage.getItem("focus-sync-pending-subscription-checkout"), /payment-client-pending-123/);

  client.clearPendingSubscriptionCheckout();

  assert.equal(client.getPendingSubscriptionCheckout(), null);
  assert.equal(storage.getItem("focus-sync-pending-subscription-checkout"), null);
});

test("checkAccountId validates a shared account without storing it locally", async () => {
  const calls = [];
  const storage = createMemoryLocalStorage();
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      return jsonResponse({
        accountId: "shared-account-123",
        displayName: "Личный",
        currentDeviceId: "device-1",
        devices: [],
      });
    },
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  const result = await client.checkAccountId(" shared-account-123 ");

  assert.equal(result.status, "ok");
  assert.equal(result.accountId, "shared-account-123");
  assert.equal(storage.getItem("focus-sync-account-id"), null);
  assert.equal(calls[0].url, "/api/sync/account");
  assert.equal(calls[0].options.headers["x-focus-account"], "shared-account-123");
  assert.equal(calls[0].options.headers["x-focus-device"], "device-1");
});

test("checkAccountId reports invalid, missing, and offline codes without replacing the current account", async () => {
  const storage = createMemoryLocalStorage({ "focus-sync-account-id": "current-account" });
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      const accountId = options.headers["x-focus-account"];
      if (url === "/api/sync/account" && accountId === "missing-account") {
        return jsonResponse({ error: "account_not_found" }, 404);
      }
      throw new Error("offline");
    },
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  assert.deepEqual(await client.checkAccountId("short"), { status: "invalid", accountId: "short" });
  assert.equal((await client.checkAccountId("missing-account")).status, "not-found");
  assert.equal((await client.checkAccountId("offline-account")).status, "offline");
  assert.equal(client.peekAccountId(), "current-account");
  assert.equal(storage.getItem("focus-sync-account-id"), "current-account");
});

test("setAccountId stores a shared account key and resets local revision", () => {
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "old-account",
    "focus-sync-revision": "7",
  });
  const client = createFocusSyncClient({
    fetch: async () => jsonResponse({}),
    localStorage: storage,
    randomUUID: () => "device-1",
  });

  assert.equal(client.setAccountId("shared-account-123"), "shared-account-123");
  assert.equal(client.peekAccountId(), "shared-account-123");
  assert.equal(storage.getItem("focus-sync-revision"), "0");
  assert.equal(storage.getItem("focus-sync-reminders-revision"), "0");
  assert.equal(storage.getItem("focus-sync-tasks-revision"), "0");
  assert.equal(storage.getItem("focus-sync-notes-revision"), "0");
  assert.equal(storage.getItem("focus-sync-birthdays-revision"), "0");
  assert.equal(storage.getItem("focus-sync-diary-revision"), "0");
});

test("setAccountId clears stale pending account-scoped queues when switching accounts", () => {
  const pendingDisconnects = JSON.stringify([{ accountId: "old-account", deviceId: "device-1" }]);
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "old-account",
    "focus-sync-device-id": "device-1",
    "focus-sync-pending-account-profile": JSON.stringify({ accountId: "old-account", displayName: "Old", deviceName: "Laptop" }),
    "focus-sync-pending-collection-pushes": JSON.stringify(["schedules", "tasks"]),
    "focus-sync-pending-device-disconnects": pendingDisconnects,
    "focus-sync-pending-subscription-checkout": JSON.stringify({
      accountId: "old-account",
      featureKey: "voiceTranscription",
      provider: "yookassa",
      paymentId: "payment-client-old-123",
    }),
  });
  const client = createFocusSyncClient({
    fetch: async () => jsonResponse({}),
    localStorage: storage,
    randomUUID: () => "device-2",
  });

  assert.equal(client.setAccountId("new-account-123"), "new-account-123");

  assert.equal(storage.getItem("focus-sync-account-id"), "new-account-123");
  assert.equal(storage.getItem("focus-sync-pending-account-profile"), null);
  assert.equal(storage.getItem("focus-sync-pending-collection-pushes"), null);
  assert.equal(storage.getItem("focus-sync-pending-subscription-checkout"), null);
  assert.equal(storage.getItem("focus-sync-pending-device-disconnects"), pendingDisconnects);
});

test("clearAccountId disconnects the current account without clearing the device id", () => {
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "orbit:account",
    "focus-sync-device-id": "device-1",
    "focus-sync-revision": "7",
    "focus-sync-pending-collection-pushes": JSON.stringify(["schedules"]),
    "focus-sync-pending-account-profile": JSON.stringify({ accountId: "orbit:account", displayName: "Focus", deviceName: "Laptop" }),
    "focus-sync-pending-subscription-checkout": JSON.stringify({
      accountId: "orbit:account",
      featureKey: "voiceTranscription",
      provider: "yookassa",
      paymentId: "payment-client-clear-123",
    }),
  });
  const client = createFocusSyncClient({
    fetch: async () => jsonResponse({}),
    localStorage: storage,
    randomUUID: () => "device-2",
  });

  client.clearAccountId();

  assert.equal(client.peekAccountId(), "");
  assert.equal(storage.getItem("focus-sync-device-id"), "device-1");
  assert.equal(storage.getItem("focus-sync-revision"), "0");
  assert.equal(storage.getItem("focus-sync-pending-collection-pushes"), null);
  assert.equal(storage.getItem("focus-sync-pending-account-profile"), null);
  assert.equal(storage.getItem("focus-sync-pending-subscription-checkout"), null);
});

test("disconnectCurrentDevice removes the remote current device without clearing local sync state", async () => {
  const calls = [];
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "shared-account-123",
    "focus-sync-device-id": "device-1",
  });
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      return jsonResponse({
        disconnected: true,
        removedDeviceSessions: 1,
        removedPushSubscriptions: 1,
      });
    },
    localStorage: storage,
    randomUUID: () => "device-2",
  });

  assert.deepEqual(await client.disconnectCurrentDevice(), {
    status: "removed",
    removedDeviceSessions: 1,
    removedPushSubscriptions: 1,
  });
  assert.equal(client.peekAccountId(), "shared-account-123");
  assert.equal(calls[0].url, "/api/sync/devices/current");
  assert.equal(calls[0].options.method, "DELETE");
  assert.equal(calls[0].options.headers["x-focus-account"], "shared-account-123");
  assert.equal(calls[0].options.headers["x-focus-device"], "device-1");
});

test("disconnectCurrentDevice queues failed server cleanup and flushes it after local disconnect", async () => {
  const calls = [];
  let online = false;
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "shared-account-123",
    "focus-sync-device-id": "device-1",
  });
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      if (!online) {
        throw new Error("offline");
      }
      return jsonResponse({ disconnected: true, removedDeviceSessions: 1, removedPushSubscriptions: 1 });
    },
    localStorage: storage,
    randomUUID: () => "device-2",
  });

  assert.equal((await client.disconnectCurrentDevice()).status, "offline");
  assert.match(storage.getItem("focus-sync-pending-device-disconnects"), /shared-account-123/);

  client.clearAccountId();
  online = true;

  assert.deepEqual(await client.flushPendingDeviceDisconnects(), {
    status: "cleared",
    attempted: 1,
    removed: 1,
    remaining: 0,
  });
  assert.equal(storage.getItem("focus-sync-account-id"), null);
  assert.equal(storage.getItem("focus-sync-pending-device-disconnects"), null);
  assert.equal(calls[1].url, "/api/sync/devices/current");
  assert.equal(calls[1].options.method, "DELETE");
  assert.equal(calls[1].options.headers["x-focus-account"], "shared-account-123");
  assert.equal(calls[1].options.headers["x-focus-device"], "device-1");
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createMemoryLocalStorage(initialValues = {}) {
  const data = new Map(Object.entries(initialValues));

  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

function createUnavailableLocalStorage() {
  return {
    getItem() {
      throw new Error("localStorage unavailable");
    },
    setItem() {
      throw new Error("localStorage unavailable");
    },
    removeItem() {
      throw new Error("localStorage unavailable");
    },
  };
}
