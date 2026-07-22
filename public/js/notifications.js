const MAX_TIMER_DELAY = 2147483647;

export function parseReminderDateTime(dateValue, timeValue) {
  const dateMatch = String(dateValue || "").trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const timeMatch = String(timeValue || "").trim().match(/^(\d{1,2}):(\d{2})$/);

  if (!dateMatch || !timeMatch) {
    return null;
  }

  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);

  if (month < 1 || month > 12 || hours > 23 || minutes > 59) {
    return null;
  }

  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hours ||
    date.getMinutes() !== minutes
  ) {
    return null;
  }

  return date;
}

export function createLocalReminder({
  id = `reminder-${Date.now()}`,
  title = "",
  date = "",
  time = "",
  createdAt = new Date(),
  now = () => new Date(),
} = {}) {
  const normalizedTitle = String(title).trim();

  if (!normalizedTitle) {
    return { ok: false, error: "empty-title" };
  }

  const scheduledDate = parseReminderDateTime(date, time);

  if (!scheduledDate) {
    return { ok: false, error: "invalid-date" };
  }

  if (scheduledDate.getTime() <= now().getTime()) {
    return { ok: false, error: "past-date" };
  }

  return {
    ok: true,
    reminder: {
      id,
      title: normalizedTitle,
      date: formatDateValue(scheduledDate),
      time: formatTimeValue(scheduledDate),
      scheduledAt: scheduledDate.toISOString(),
      createdAt: createdAt.toISOString(),
      deliveredAt: null,
    },
  };
}

export function createFocusNotifications({
  notificationApi = globalThis.Notification,
  navigatorApi = globalThis.navigator,
  setTimeoutImpl = globalThis.setTimeout?.bind(globalThis),
  clearTimeoutImpl = globalThis.clearTimeout?.bind(globalThis),
  now = () => new Date(),
  maxTimerDelay = MAX_TIMER_DELAY,
} = {}) {
  const timers = new Map();

  const getPermission = () => {
    if (!notificationApi) {
      return "unsupported";
    }

    return notificationApi.permission || "default";
  };

  const requestPermission = async () => {
    if (!notificationApi?.requestPermission) {
      return "unsupported";
    }

    if (notificationApi.permission === "granted" || notificationApi.permission === "denied") {
      return notificationApi.permission;
    }

    return notificationApi.requestPermission();
  };

  const subscribePush = async publicKey => {
    if (!publicKey) {
      return { status: "missing-key" };
    }

    try {
      const registration = await navigatorApi?.serviceWorker?.ready;
      if (!registration?.pushManager?.subscribe) {
        return { status: "unsupported" };
      }

      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      const existingSubscription = await registration.pushManager.getSubscription?.();

      if (existingSubscription && pushSubscriptionUsesKey(existingSubscription, applicationServerKey)) {
        return {
          status: "subscribed",
          reused: true,
          subscription: typeof existingSubscription.toJSON === "function" ? existingSubscription.toJSON() : existingSubscription,
        };
      }

      if (existingSubscription?.unsubscribe) {
        await existingSubscription.unsubscribe();
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      return {
        status: "subscribed",
        renewed: Boolean(existingSubscription),
        subscription: typeof subscription.toJSON === "function" ? subscription.toJSON() : subscription,
      };
    } catch {
      return { status: "failed" };
    }
  };

  const clearReminder = reminderId => {
    const timer = timers.get(reminderId);

    if (timer && clearTimeoutImpl) {
      clearTimeoutImpl(timer);
    }

    timers.delete(reminderId);
  };

  const showReminder = async reminder => {
    if (getPermission() !== "granted") {
      return false;
    }

    const options = {
      body: reminder.title,
      tag: `focus-reminder-${reminder.id}`,
      renotify: true,
      icon: "/assets/icons/icon-192.png",
      badge: "/assets/icons/favicon-32.png",
      data: {
        reminderId: reminder.id,
        url: "/",
      },
    };

    try {
      const registration = await navigatorApi?.serviceWorker?.ready;

      if (registration?.showNotification) {
        await registration.showNotification("Фокус", options);
        return true;
      }
    } catch {
      // Fall back to the page Notification constructor below.
    }

    if (typeof notificationApi === "function") {
      new notificationApi("Фокус", options);
      return true;
    }

    return false;
  };

  const schedule = (reminder, onDelivered) => {
    if (!setTimeoutImpl || !reminder?.id || !reminder.scheduledAt) {
      return false;
    }

    clearReminder(reminder.id);

    const targetTime = new Date(reminder.scheduledAt).getTime();

    if (!Number.isFinite(targetTime)) {
      return false;
    }

    const delay = targetTime - now().getTime();

    if (delay <= 0) {
      return false;
    }

    const timer = setTimeoutImpl(async () => {
      timers.delete(reminder.id);

      if (delay > maxTimerDelay) {
        schedule(reminder, onDelivered);
        return;
      }

      await showReminder(reminder);
      onDelivered?.(reminder);
    }, Math.min(delay, maxTimerDelay));

    timers.set(reminder.id, timer);
    return true;
  };

  return {
    getPermission,
    requestPermission,
    subscribePush,
    showReminder,
    schedule,
    scheduleMany(reminders, onDelivered) {
      return (Array.isArray(reminders) ? reminders : []).filter(reminder => schedule(reminder, onDelivered)).length;
    },
    clearReminder,
  };
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = typeof atob === "function"
    ? atob(base64)
    : Buffer.from(base64, "base64").toString("binary");
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function pushSubscriptionUsesKey(subscription, applicationServerKey) {
  const existingKey = subscription?.options?.applicationServerKey;

  if (!existingKey || !applicationServerKey) {
    return true;
  }

  const existingBytes = existingKey instanceof Uint8Array
    ? existingKey
    : new Uint8Array(existingKey);

  if (existingBytes.length !== applicationServerKey.length) {
    return false;
  }

  return existingBytes.every((byte, index) => byte === applicationServerKey[index]);
}

function formatDateValue(date) {
  return [
    String(date.getDate()).padStart(2, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getFullYear()),
  ].join(".");
}

function formatTimeValue(date) {
  return [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
  ].join(":");
}
