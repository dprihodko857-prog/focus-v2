import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createFocusNotifications,
  createLocalReminder,
  parseReminderDateTime,
} from "../public/js/notifications.js";

test("parseReminderDateTime accepts local dd.mm.yyyy and HH:MM values", () => {
  const date = parseReminderDateTime("15.07.2026", "09:30");

  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 6);
  assert.equal(date.getDate(), 15);
  assert.equal(date.getHours(), 9);
  assert.equal(date.getMinutes(), 30);
});

test("createLocalReminder rejects empty, invalid, and past reminders", () => {
  const now = () => new Date(2026, 6, 10, 12, 0);

  assert.equal(createLocalReminder({ title: "", date: "15.07.2026", time: "09:30", now }).error, "empty-title");
  assert.equal(createLocalReminder({ title: "Call", date: "bad", time: "09:30", now }).error, "invalid-date");
  assert.equal(createLocalReminder({ title: "Call", date: "10.07.2026", time: "11:59", now }).error, "past-date");
});

test("createLocalReminder returns a normalized future reminder", () => {
  const now = () => new Date(2026, 6, 10, 12, 0);
  const result = createLocalReminder({
    id: "reminder-1",
    title: "  Call Sergey  ",
    date: "15.07.2026",
    time: "09:30",
    createdAt: new Date(2026, 6, 10, 12, 1),
    now,
  });

  assert.equal(result.ok, true);
  assert.equal(result.reminder.id, "reminder-1");
  assert.equal(result.reminder.title, "Call Sergey");
  assert.equal(result.reminder.date, "15.07.2026");
  assert.equal(result.reminder.time, "09:30");
  assert.equal(result.reminder.deliveredAt, null);
});

test("notification scheduler requests permission and uses service worker notifications", async () => {
  const timers = [];
  const delivered = [];
  const shown = [];
  const notificationApi = {
    permission: "default",
    async requestPermission() {
      this.permission = "granted";
      return "granted";
    },
  };
  const notifications = createFocusNotifications({
    notificationApi,
    navigatorApi: {
      serviceWorker: {
        ready: Promise.resolve({
          showNotification: async (title, options) => {
            shown.push({ title, options });
          },
        }),
      },
    },
    now: () => new Date(2026, 6, 10, 12, 0),
    setTimeoutImpl(callback, delay) {
      timers.push({ callback, delay });
      return timers.length;
    },
    clearTimeoutImpl() {},
  });

  assert.equal(await notifications.requestPermission(), "granted");
  assert.equal(notifications.schedule({
    id: "reminder-1",
    title: "Call Sergey",
    scheduledAt: new Date(2026, 6, 10, 12, 5).toISOString(),
  }, reminder => delivered.push(reminder.id)), true);
  assert.equal(timers[0].delay, 300000);

  await timers[0].callback();

  assert.deepEqual(delivered, ["reminder-1"]);
  assert.equal(shown[0].title, "Фокус");
  assert.equal(shown[0].options.body, "Call Sergey");
  assert.equal(shown[0].options.tag, "focus-reminder-reminder-1");
});

test("push subscription renews when the VAPID application server key changes", async () => {
  let unsubscribed = false;
  let subscribeOptions = null;
  const existingSubscription = {
    options: {
      applicationServerKey: new Uint8Array([9, 9, 9]).buffer,
    },
    async unsubscribe() {
      unsubscribed = true;
      return true;
    },
    toJSON() {
      return { endpoint: "https://push.example/old", keys: { p256dh: "old", auth: "old" } };
    },
  };
  const newSubscription = {
    toJSON() {
      return { endpoint: "https://push.example/new", keys: { p256dh: "new", auth: "new" } };
    },
  };
  const notifications = createFocusNotifications({
    notificationApi: { permission: "granted" },
    navigatorApi: {
      serviceWorker: {
        ready: Promise.resolve({
          pushManager: {
            async getSubscription() {
              return existingSubscription;
            },
            async subscribe(options) {
              subscribeOptions = options;
              return newSubscription;
            },
          },
        }),
      },
    },
  });

  const result = await notifications.subscribePush("AQIDBA");

  assert.equal(unsubscribed, true);
  assert.equal(result.status, "subscribed");
  assert.equal(result.renewed, true);
  assert.deepEqual(Array.from(subscribeOptions.applicationServerKey), [1, 2, 3, 4]);
  assert.equal(result.subscription.endpoint, "https://push.example/new");
});

test("push subscription reports actionable mobile failure reasons", async () => {
  const notifications = createFocusNotifications({
    notificationApi: { permission: "granted" },
    navigatorApi: {
      serviceWorker: {
        ready: Promise.resolve({
          pushManager: {
            async getSubscription() {
              return null;
            },
            async subscribe() {
              throw new DOMException("Permission blocked", "NotAllowedError");
            },
          },
        }),
      },
    },
  });

  const result = await notifications.subscribePush("AQIDBA");

  assert.equal(result.status, "permission-denied");
  assert.equal(result.errorName, "NotAllowedError");
});

test("push subscription requires notification permission before subscribing", async () => {
  const notifications = createFocusNotifications({
    notificationApi: { permission: "default" },
  });

  const result = await notifications.subscribePush("AQIDBA");

  assert.equal(result.status, "permission-required");
});

test("notification scheduler reschedules reminders beyond the maximum timer delay", async () => {
  const timers = [];
  const delivered = [];
  const shown = [];
  let nowMs = new Date(2026, 6, 10, 12, 0).getTime();
  const notifications = createFocusNotifications({
    notificationApi: { permission: "granted" },
    navigatorApi: {
      serviceWorker: {
        ready: Promise.resolve({
          showNotification: async (title, options) => {
            shown.push({ title, options });
          },
        }),
      },
    },
    now: () => new Date(nowMs),
    maxTimerDelay: 1000,
    setTimeoutImpl(callback, delay) {
      timers.push({ callback, delay });
      return timers.length;
    },
    clearTimeoutImpl() {},
  });

  assert.equal(notifications.schedule({
    id: "far-reminder",
    title: "Far reminder",
    scheduledAt: new Date(nowMs + 2500).toISOString(),
  }, reminder => delivered.push(reminder.id)), true);

  assert.equal(timers[0].delay, 1000);
  nowMs += 1000;
  await timers[0].callback();
  assert.deepEqual(delivered, []);
  assert.deepEqual(shown, []);
  assert.equal(timers[1].delay, 1000);

  nowMs += 1000;
  await timers[1].callback();
  assert.deepEqual(delivered, []);
  assert.deepEqual(shown, []);
  assert.equal(timers[2].delay, 500);

  nowMs += 500;
  await timers[2].callback();
  assert.deepEqual(delivered, ["far-reminder"]);
  assert.equal(shown[0].options.body, "Far reminder");
});
