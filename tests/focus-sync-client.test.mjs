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

test("clearAccountId disconnects the current account without clearing the device id", () => {
  const storage = createMemoryLocalStorage({
    "focus-sync-account-id": "orbit:account",
    "focus-sync-device-id": "device-1",
    "focus-sync-revision": "7",
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
