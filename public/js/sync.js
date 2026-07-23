const ACCOUNT_KEY = "focus-sync-account-id";
const DEVICE_KEY = "focus-sync-device-id";
const DEVICE_NAME_KEY = "focus-sync-device-name";
const REVISION_KEY = "focus-sync-revision";
const REMINDERS_REVISION_KEY = "focus-sync-reminders-revision";
const TASKS_REVISION_KEY = "focus-sync-tasks-revision";
const NOTES_REVISION_KEY = "focus-sync-notes-revision";
const BIRTHDAYS_REVISION_KEY = "focus-sync-birthdays-revision";
const DIARY_REVISION_KEY = "focus-sync-diary-revision";

export function createFocusSyncClient({
  apiBaseUrl = "/api",
  fetch: fetchImpl = globalThis.fetch?.bind(globalThis),
  localStorage = globalThis.localStorage,
  navigator = globalThis.navigator,
  randomUUID = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
} = {}) {
  let pendingAccountIdPromise = null;

  const getStored = key => {
    try {
      return localStorage?.getItem(key) || "";
    } catch {
      return "";
    }
  };

  const setStored = (key, value) => {
    try {
      localStorage?.setItem(key, String(value));
    } catch {
      // Sync state is an enhancement; local IndexedDB remains the source of truth offline.
    }
  };

  const removeStored = key => {
    try {
      localStorage?.removeItem(key);
    } catch {
      // Sync state is an enhancement; local IndexedDB remains the source of truth offline.
    }
  };

  const getDeviceId = () => {
    const existing = getStored(DEVICE_KEY);
    if (existing) return existing;

    const deviceId = randomUUID();
    setStored(DEVICE_KEY, deviceId);
    return deviceId;
  };

  const getDeviceName = () => {
    const existing = getStored(DEVICE_NAME_KEY);
    if (existing) return existing;

    const deviceName = createDefaultDeviceName(navigator);
    setStored(DEVICE_NAME_KEY, deviceName);
    return deviceName;
  };

  const setDeviceName = deviceName => {
    const normalizedDeviceName = normalizeStoredName(deviceName) || createDefaultDeviceName(navigator);
    setStored(DEVICE_NAME_KEY, normalizedDeviceName);
    return normalizedDeviceName;
  };

  const createRemoteAccountId = async () => {
    const response = await fetchImpl(apiUrl(apiBaseUrl, "/sync/accounts"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    if (!response.ok) {
      throw new Error("Focus sync account creation failed.");
    }

    const account = await response.json();
    setStored(ACCOUNT_KEY, account.accountId);
    return account.accountId;
  };

  const getAccountId = async () => {
    const existing = getStored(ACCOUNT_KEY);
    if (existing) return existing;

    if (!pendingAccountIdPromise) {
      pendingAccountIdPromise = createRemoteAccountId().finally(() => {
        pendingAccountIdPromise = null;
      });
    }

    return pendingAccountIdPromise;
  };

  const getRevision = (key = REVISION_KEY) => Number(getStored(key) || 0);
  const setRevision = (revision, key = REVISION_KEY) => setStored(key, Number(revision) || 0);

  const withHeaders = async () => ({
    "content-type": "application/json",
    "x-focus-account": await getAccountId(),
    "x-focus-device": getDeviceId(),
    "x-focus-device-name": encodeHeaderValue(getDeviceName()),
  });

  const getRemoteSnapshot = async path => {
    const response = await fetchImpl(apiUrl(apiBaseUrl, path), {
      headers: await withHeaders(),
    });

    if (!response.ok) {
      throw new Error("Focus sync snapshot load failed.");
    }

    return response.json();
  };

  const putRemoteSnapshot = async (path, payload) => {
    const response = await fetchImpl(apiUrl(apiBaseUrl, path), {
      method: "PUT",
      headers: await withHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Focus sync snapshot save failed.");
    }

    return response.json();
  };

  const getRemoteScheduleSnapshot = () => getRemoteSnapshot("/sync/schedules");
  const putRemoteScheduleSnapshot = schedules => putRemoteSnapshot("/sync/schedules", {
    schedules: Array.isArray(schedules) ? schedules : [],
  });
  const getRemoteReminderSnapshot = () => getRemoteSnapshot("/sync/reminders");
  const putRemoteReminderSnapshot = reminders => putRemoteSnapshot("/sync/reminders", {
    reminders: Array.isArray(reminders) ? reminders : [],
  });
  const getRemoteTaskSnapshot = () => getRemoteSnapshot("/sync/tasks");
  const putRemoteTaskSnapshot = tasks => putRemoteSnapshot("/sync/tasks", {
    tasks: Array.isArray(tasks) ? tasks : [],
  });
  const getRemoteNoteSnapshot = () => getRemoteSnapshot("/sync/notes");
  const putRemoteNoteSnapshot = notes => putRemoteSnapshot("/sync/notes", {
    notes: Array.isArray(notes) ? notes : [],
  });
  const getRemoteBirthdaySnapshot = () => getRemoteSnapshot("/sync/birthdays");
  const putRemoteBirthdaySnapshot = birthdays => putRemoteSnapshot("/sync/birthdays", {
    birthdays: Array.isArray(birthdays) ? birthdays : [],
  });
  const getRemoteDiarySnapshot = () => getRemoteSnapshot("/sync/diary");
  const putRemoteDiarySnapshot = entries => putRemoteSnapshot("/sync/diary", {
    entries: Array.isArray(entries) ? entries : [],
  });

  return {
    peekAccountId() {
      return getStored(ACCOUNT_KEY);
    },

    peekDeviceId() {
      return getStored(DEVICE_KEY);
    },

    peekDeviceName() {
      return getDeviceName();
    },

    setDeviceName,

    setAccountId(accountId) {
      const normalizedAccountId = String(accountId || "").trim();
      if (!/^[a-zA-Z0-9_.:-]{8,160}$/.test(normalizedAccountId)) {
        throw new Error("Focus sync account key is invalid.");
      }

      setStored(ACCOUNT_KEY, normalizedAccountId);
      setRevision(0);
      setRevision(0, REMINDERS_REVISION_KEY);
      setRevision(0, TASKS_REVISION_KEY);
      setRevision(0, NOTES_REVISION_KEY);
      setRevision(0, BIRTHDAYS_REVISION_KEY);
      setRevision(0, DIARY_REVISION_KEY);
      return normalizedAccountId;
    },

    clearAccountId() {
      removeStored(ACCOUNT_KEY);
      setRevision(0);
      setRevision(0, REMINDERS_REVISION_KEY);
      setRevision(0, TASKS_REVISION_KEY);
      setRevision(0, NOTES_REVISION_KEY);
      setRevision(0, BIRTHDAYS_REVISION_KEY);
      setRevision(0, DIARY_REVISION_KEY);
    },

    getAccountId,
    getDeviceId,
    getDeviceName,

    async getAccountProfile() {
      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/sync/account"), {
          headers: await withHeaders(),
        });

        if (!response.ok) {
          throw new Error("Focus sync account profile load failed.");
        }

        return { status: "ok", ...await response.json() };
      } catch {
        return {
          status: "offline",
          accountId: getStored(ACCOUNT_KEY),
          currentDeviceId: getDeviceId(),
          devices: [],
        };
      }
    },

    async updateAccountProfile({ displayName, deviceName } = {}) {
      const body = {};
      if (displayName !== undefined) {
        body.displayName = normalizeStoredName(displayName) || "";
      }
      if (deviceName !== undefined) {
        body.deviceName = setDeviceName(deviceName);
      }

      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/sync/account"), {
          method: "PATCH",
          headers: await withHeaders(),
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error("Focus sync account profile save failed.");
        }

        return { status: "ok", ...await response.json() };
      } catch {
        return {
          status: "offline",
          accountId: getStored(ACCOUNT_KEY),
          currentDeviceId: getDeviceId(),
          devices: [],
        };
      }
    },

    async syncSchedules(localSchedules) {
      const schedules = Array.isArray(localSchedules) ? localSchedules : [];

      try {
        const remote = await getRemoteScheduleSnapshot();
        const localRevision = getRevision();

        if (remote.revision > localRevision) {
          setRevision(remote.revision);
          return {
            status: "pulled",
            schedules: Array.isArray(remote.schedules) ? remote.schedules : [],
            revision: remote.revision,
          };
        }

        if (!schedules.length && remote.revision === 0) {
          return { status: "idle", schedules, revision: localRevision };
        }

        const saved = await putRemoteScheduleSnapshot(schedules);
        setRevision(saved.revision);
        return { status: "pushed", schedules, revision: saved.revision };
      } catch {
        return { status: "offline", schedules };
      }
    },

    async pushSchedules(localSchedules) {
      const schedules = Array.isArray(localSchedules) ? localSchedules : [];

      try {
        const saved = await putRemoteScheduleSnapshot(schedules);
        setRevision(saved.revision);
        return { status: "pushed", schedules, revision: saved.revision };
      } catch {
        return { status: "offline", schedules };
      }
    },

    async syncReminders(localReminders) {
      const reminders = Array.isArray(localReminders) ? localReminders : [];

      try {
        const remote = await getRemoteReminderSnapshot();
        const localRevision = getRevision(REMINDERS_REVISION_KEY);

        if (remote.revision > localRevision) {
          setRevision(remote.revision, REMINDERS_REVISION_KEY);
          return {
            status: "pulled",
            reminders: Array.isArray(remote.reminders) ? remote.reminders : [],
            revision: remote.revision,
          };
        }

        if (!reminders.length && remote.revision === 0) {
          return { status: "idle", reminders, revision: localRevision };
        }

        const saved = await putRemoteReminderSnapshot(reminders);
        setRevision(saved.revision, REMINDERS_REVISION_KEY);
        return { status: "pushed", reminders, revision: saved.revision };
      } catch {
        return { status: "offline", reminders };
      }
    },

    async pushReminders(localReminders) {
      const reminders = Array.isArray(localReminders) ? localReminders : [];

      try {
        const saved = await putRemoteReminderSnapshot(reminders);
        setRevision(saved.revision, REMINDERS_REVISION_KEY);
        return { status: "pushed", reminders, revision: saved.revision };
      } catch {
        return { status: "offline", reminders };
      }
    },

    async syncTasks(localTasks) {
      const tasks = Array.isArray(localTasks) ? localTasks : [];

      try {
        const remote = await getRemoteTaskSnapshot();
        const localRevision = getRevision(TASKS_REVISION_KEY);

        if (remote.revision > localRevision) {
          setRevision(remote.revision, TASKS_REVISION_KEY);
          return {
            status: "pulled",
            tasks: Array.isArray(remote.tasks) ? remote.tasks : [],
            revision: remote.revision,
          };
        }

        if (!tasks.length && remote.revision === 0) {
          return { status: "idle", tasks, revision: localRevision };
        }

        const saved = await putRemoteTaskSnapshot(tasks);
        setRevision(saved.revision, TASKS_REVISION_KEY);
        return { status: "pushed", tasks, revision: saved.revision };
      } catch {
        return { status: "offline", tasks };
      }
    },

    async pushTasks(localTasks) {
      const tasks = Array.isArray(localTasks) ? localTasks : [];

      try {
        const saved = await putRemoteTaskSnapshot(tasks);
        setRevision(saved.revision, TASKS_REVISION_KEY);
        return { status: "pushed", tasks, revision: saved.revision };
      } catch {
        return { status: "offline", tasks };
      }
    },

    async syncNotes(localNotes) {
      const notes = Array.isArray(localNotes) ? localNotes : [];

      try {
        const remote = await getRemoteNoteSnapshot();
        const localRevision = getRevision(NOTES_REVISION_KEY);

        if (remote.revision > localRevision) {
          setRevision(remote.revision, NOTES_REVISION_KEY);
          return {
            status: "pulled",
            notes: Array.isArray(remote.notes) ? remote.notes : [],
            revision: remote.revision,
          };
        }

        if (!notes.length && remote.revision === 0) {
          return { status: "idle", notes, revision: localRevision };
        }

        const saved = await putRemoteNoteSnapshot(notes);
        setRevision(saved.revision, NOTES_REVISION_KEY);
        return { status: "pushed", notes, revision: saved.revision };
      } catch {
        return { status: "offline", notes };
      }
    },

    async pushNotes(localNotes) {
      const notes = Array.isArray(localNotes) ? localNotes : [];

      try {
        const saved = await putRemoteNoteSnapshot(notes);
        setRevision(saved.revision, NOTES_REVISION_KEY);
        return { status: "pushed", notes, revision: saved.revision };
      } catch {
        return { status: "offline", notes };
      }
    },

    async syncBirthdays(localBirthdays) {
      const birthdays = Array.isArray(localBirthdays) ? localBirthdays : [];

      try {
        const remote = await getRemoteBirthdaySnapshot();
        const localRevision = getRevision(BIRTHDAYS_REVISION_KEY);

        if (remote.revision > localRevision) {
          setRevision(remote.revision, BIRTHDAYS_REVISION_KEY);
          return {
            status: "pulled",
            birthdays: Array.isArray(remote.birthdays) ? remote.birthdays : [],
            revision: remote.revision,
          };
        }

        if (!birthdays.length && remote.revision === 0) {
          return { status: "idle", birthdays, revision: localRevision };
        }

        const saved = await putRemoteBirthdaySnapshot(birthdays);
        setRevision(saved.revision, BIRTHDAYS_REVISION_KEY);
        return { status: "pushed", birthdays, revision: saved.revision };
      } catch {
        return { status: "offline", birthdays };
      }
    },

    async pushBirthdays(localBirthdays) {
      const birthdays = Array.isArray(localBirthdays) ? localBirthdays : [];

      try {
        const saved = await putRemoteBirthdaySnapshot(birthdays);
        setRevision(saved.revision, BIRTHDAYS_REVISION_KEY);
        return { status: "pushed", birthdays, revision: saved.revision };
      } catch {
        return { status: "offline", birthdays };
      }
    },

    async syncDiaryEntries(localEntries) {
      const entries = Array.isArray(localEntries) ? localEntries : [];

      try {
        const remote = await getRemoteDiarySnapshot();
        const localRevision = getRevision(DIARY_REVISION_KEY);

        if (remote.revision > localRevision) {
          setRevision(remote.revision, DIARY_REVISION_KEY);
          return {
            status: "pulled",
            entries: Array.isArray(remote.entries) ? remote.entries : [],
            revision: remote.revision,
          };
        }

        if (!entries.length && remote.revision === 0) {
          return { status: "idle", entries, revision: localRevision };
        }

        const saved = await putRemoteDiarySnapshot(entries);
        setRevision(saved.revision, DIARY_REVISION_KEY);
        return { status: "pushed", entries, revision: saved.revision };
      } catch {
        return { status: "offline", entries };
      }
    },

    async pushDiaryEntries(localEntries) {
      const entries = Array.isArray(localEntries) ? localEntries : [];

      try {
        const saved = await putRemoteDiarySnapshot(entries);
        setRevision(saved.revision, DIARY_REVISION_KEY);
        return { status: "pushed", entries, revision: saved.revision };
      } catch {
        return { status: "offline", entries };
      }
    },

    async getPushConfig() {
      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/push/config"));
        if (!response.ok) {
          throw new Error("Focus push config load failed.");
        }
        return response.json();
      } catch {
        return { configured: false, publicKey: null };
      }
    },

    async savePushSubscription(subscription) {
      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/push/subscriptions"), {
          method: "PUT",
          headers: await withHeaders(),
          body: JSON.stringify({ subscription }),
        });

        if (!response.ok) {
          throw new Error("Focus push subscription save failed.");
        }

        const result = await response.json();
        return { status: "saved", subscriptions: result.subscriptions || 0 };
      } catch {
        return { status: "offline" };
      }
    },

    async getPushSubscriptionStatus() {
      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/push/subscriptions/status"), {
          headers: await withHeaders(),
        });

        if (!response.ok) {
          throw new Error("Focus push subscription status load failed.");
        }

        return { status: "ok", ...await response.json() };
      } catch {
        return {
          status: "offline",
          configured: false,
          deviceRegistered: false,
          subscriptions: 0,
          deviceSubscriptions: 0,
          updatedAt: null,
        };
      }
    },

    async getReminderDeliveryStatus() {
      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/push/reminders/status"), {
          headers: await withHeaders(),
        });

        if (!response.ok) {
          throw new Error("Focus reminder delivery status load failed.");
        }

        return { status: "ok", ...await response.json() };
      } catch {
        return {
          status: "offline",
          subscriptions: 0,
          stats: createEmptyReminderDeliveryStats(),
          attention: [],
          next: null,
          updatedAt: null,
        };
      }
    },

    async getPushEvents() {
      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/push/events"), {
          headers: await withHeaders(),
        });

        if (!response.ok) {
          throw new Error("Focus push events load failed.");
        }

        const result = await response.json();
        return {
          status: "ok",
          events: Array.isArray(result.events) ? result.events : [],
        };
      } catch {
        return {
          status: "offline",
          events: [],
        };
      }
    },

    async sendTestPushNotification() {
      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/push/test"), {
          method: "POST",
          headers: await withHeaders(),
          body: "{}",
        });

        if (response.status === 503) {
          return { status: "not-configured", sent: 0, failed: 0, removed: 0, deviceSubscriptions: 0 };
        }

        if (!response.ok) {
          throw new Error("Focus test push failed.");
        }

        const result = await response.json();
        return {
          status: result.sent > 0 ? "sent" : "empty",
          sent: result.sent || 0,
          failed: result.failed || 0,
          removed: result.removed || 0,
          deviceSubscriptions: result.deviceSubscriptions || 0,
        };
      } catch {
        return { status: "offline", sent: 0, failed: 0, removed: 0, deviceSubscriptions: 0 };
      }
    },
  };
}

function createEmptyReminderDeliveryStats() {
  return {
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
}

function apiUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

function encodeHeaderValue(value) {
  return encodeURIComponent(String(value || ""));
}

function normalizeStoredName(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

function createDefaultDeviceName(navigatorRef) {
  const platform = normalizeStoredName(navigatorRef?.userAgentData?.platform || navigatorRef?.platform || "");
  if (platform) return `${platform} device`;

  const userAgent = String(navigatorRef?.userAgent || "");
  if (/iPhone/i.test(userAgent)) return "iPhone";
  if (/iPad/i.test(userAgent)) return "iPad";
  if (/Android/i.test(userAgent)) return "Android device";
  if (/Windows/i.test(userAgent)) return "Windows device";
  if (/Mac OS|Macintosh/i.test(userAgent)) return "Mac device";
  if (/Linux/i.test(userAgent)) return "Linux device";
  return "Focus device";
}
