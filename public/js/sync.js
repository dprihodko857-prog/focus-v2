import {
  getHolidayCatalogVersion as getBundledHolidayCatalogVersion,
  getProfessionalHolidayCategories as getBundledProfessionalHolidayCategories,
  getPublishedHolidayCatalog as getBundledPublishedHolidayCatalog,
  normalizeHolidayPreferences,
} from "./holiday-catalog.js";

const ACCOUNT_KEY = "focus-sync-account-id";
const DEVICE_KEY = "focus-sync-device-id";
const DEVICE_NAME_KEY = "focus-sync-device-name";
const REVISION_KEY = "focus-sync-revision";
const REMINDERS_REVISION_KEY = "focus-sync-reminders-revision";
const TASKS_REVISION_KEY = "focus-sync-tasks-revision";
const NOTES_REVISION_KEY = "focus-sync-notes-revision";
const BIRTHDAYS_REVISION_KEY = "focus-sync-birthdays-revision";
const DIARY_REVISION_KEY = "focus-sync-diary-revision";
const PENDING_DEVICE_DISCONNECTS_KEY = "focus-sync-pending-device-disconnects";
const PENDING_ACCOUNT_PROFILE_KEY = "focus-sync-pending-account-profile";
const PENDING_COLLECTION_PUSHES_KEY = "focus-sync-pending-collection-pushes";
const PENDING_SUBSCRIPTION_CHECKOUT_KEY = "focus-sync-pending-subscription-checkout";
const ACCOUNT_ID_PATTERN = /^[a-zA-Z0-9_.:-]{8,160}$/;
const DEVICE_ID_PATTERN = /^[a-zA-Z0-9_.:-]{4,160}$/;
const PAYMENT_ID_PATTERN = /^[a-zA-Z0-9_.:-]{8,160}$/;
const QUOTE_ID_PATTERN = /^[a-zA-Z0-9_.:-]{1,160}$/;
const QUOTE_CATEGORY_PATTERN = /^[a-z][a-z0-9_]{1,80}$/;
const COLLECTION_KEYS = new Set(["schedules", "reminders", "tasks", "notes", "birthdays", "diary"]);
const ENTITLEMENT_SOURCE_PATTERN = /^[a-zA-Z0-9_.:-]{1,80}$/;
const VOICE_TRANSCRIPTION_FEATURE_KEY = "voiceTranscription";
const PAID_FEATURE_KEYS = new Set([VOICE_TRANSCRIPTION_FEATURE_KEY]);
const MAX_TRANSCRIPTION_AUDIO_BASE64_LENGTH = 768 * 1024;
const MAX_TRANSCRIPTION_DURATION_MS = 60 * 1000;
const PERSONAL_SCHEDULE_PROMPT_VERSION = "personal-schedule-planner@2026-08-04.v1";
const MAX_PERSONAL_SCHEDULE_REQUEST_LENGTH = 96 * 1024;
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

export function createFocusSyncClient({
  apiBaseUrl = "/api",
  fetch: fetchImpl = globalThis.fetch?.bind(globalThis),
  localStorage = globalThis.localStorage,
  navigator = globalThis.navigator,
  randomUUID = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
} = {}) {
  let pendingAccountIdPromise = null;
  const pushQueues = new Map();
  const memoryStore = new Map();
  let storageFallbackActive = !localStorage;

  const getStored = key => {
    if (!storageFallbackActive) {
      try {
        const value = localStorage.getItem(key);
        if (value === null || value === undefined) {
          memoryStore.delete(key);
          return "";
        }

        const normalizedValue = String(value);
        memoryStore.set(key, normalizedValue);
        return normalizedValue;
      } catch {
        storageFallbackActive = true;
      }
    }

    return memoryStore.get(key) || "";
  };

  const setStored = (key, value) => {
    const normalizedValue = String(value);
    memoryStore.set(key, normalizedValue);

    try {
      localStorage?.setItem(key, normalizedValue);
      storageFallbackActive = !localStorage;
    } catch {
      storageFallbackActive = true;
    }
  };

  const removeStored = key => {
    memoryStore.delete(key);

    try {
      localStorage?.removeItem(key);
      storageFallbackActive = !localStorage;
    } catch {
      // Sync state is an enhancement; local IndexedDB remains the source of truth offline.
      storageFallbackActive = true;
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

  const normalizeAccountId = accountId => String(accountId || "").trim();
  const isValidAccountId = accountId => ACCOUNT_ID_PATTERN.test(accountId);
  const normalizePaymentId = paymentId => {
    const normalizedPaymentId = String(paymentId || "").trim();
    return PAYMENT_ID_PATTERN.test(normalizedPaymentId) ? normalizedPaymentId : "";
  };
  const normalizeQuoteId = quoteId => {
    const normalizedQuoteId = String(quoteId || "").trim();
    return QUOTE_ID_PATTERN.test(normalizedQuoteId) ? normalizedQuoteId : "";
  };
  const getCurrentTimezone = () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  };
  const normalizeSubscriptionCheckoutStatus = status => {
    const normalizedStatus = String(status || "").trim().replace(/_/g, "-");
    return [
      "activated",
      "pending",
      "canceled",
      "failed",
      "ignored",
      "provider-not-configured",
    ].includes(normalizedStatus) ? normalizedStatus : "pending";
  };
  const withAccountHeaders = (accountId, deviceId = getDeviceId()) => ({
    "content-type": "application/json",
    "x-focus-account": accountId,
    "x-focus-device": deviceId,
    "x-focus-device-name": encodeHeaderValue(getDeviceName()),
  });
  const withHeaders = async () => withAccountHeaders(await getAccountId());

  const getPendingDeviceDisconnects = () => {
    try {
      const parsed = JSON.parse(getStored(PENDING_DEVICE_DISCONNECTS_KEY) || "[]");
      return Array.isArray(parsed)
        ? parsed.filter(item => isValidAccountId(item?.accountId) && DEVICE_ID_PATTERN.test(item?.deviceId || ""))
        : [];
    } catch {
      return [];
    }
  };

  const setPendingDeviceDisconnects = items => {
    const disconnects = Array.isArray(items)
      ? items.filter(item => isValidAccountId(item?.accountId) && DEVICE_ID_PATTERN.test(item?.deviceId || ""))
      : [];

    if (!disconnects.length) {
      removeStored(PENDING_DEVICE_DISCONNECTS_KEY);
      return;
    }

    setStored(PENDING_DEVICE_DISCONNECTS_KEY, JSON.stringify(disconnects));
  };

  const queuePendingDeviceDisconnect = disconnect => {
    const pending = getPendingDeviceDisconnects();
    const exists = pending.some(item => item.accountId === disconnect.accountId && item.deviceId === disconnect.deviceId);
    if (!exists) {
      pending.push({
        accountId: disconnect.accountId,
        deviceId: disconnect.deviceId,
      });
    }
    setPendingDeviceDisconnects(pending);
  };

  const getPendingAccountProfileUpdate = () => {
    try {
      const parsed = JSON.parse(getStored(PENDING_ACCOUNT_PROFILE_KEY) || "null");
      if (!isValidAccountId(parsed?.accountId)) return null;

      return {
        accountId: parsed.accountId,
        displayName: normalizeStoredName(parsed.displayName || ""),
        deviceName: normalizeStoredName(parsed.deviceName || ""),
      };
    } catch {
      return null;
    }
  };

  const queuePendingAccountProfileUpdate = update => {
    if (!isValidAccountId(update?.accountId)) return;

    setStored(PENDING_ACCOUNT_PROFILE_KEY, JSON.stringify({
      accountId: update.accountId,
      displayName: normalizeStoredName(update.displayName || ""),
      deviceName: normalizeStoredName(update.deviceName || ""),
    }));
  };

  const getPendingCollectionPushes = () => {
    try {
      const parsed = JSON.parse(getStored(PENDING_COLLECTION_PUSHES_KEY) || "[]");
      const values = Array.isArray(parsed) ? parsed : Object.keys(parsed || {});
      return values.filter(collectionKey => COLLECTION_KEYS.has(collectionKey));
    } catch {
      return [];
    }
  };

  const setPendingCollectionPushes = collectionKeys => {
    const uniqueKeys = [...new Set(Array.isArray(collectionKeys) ? collectionKeys : [])]
      .filter(collectionKey => COLLECTION_KEYS.has(collectionKey));

    if (!uniqueKeys.length) {
      removeStored(PENDING_COLLECTION_PUSHES_KEY);
      return;
    }

    setStored(PENDING_COLLECTION_PUSHES_KEY, JSON.stringify(uniqueKeys));
  };

  const markPendingCollectionPush = collectionKey => {
    if (!COLLECTION_KEYS.has(collectionKey)) return;
    setPendingCollectionPushes([...getPendingCollectionPushes(), collectionKey]);
  };

  const clearPendingCollectionPush = collectionKey => {
    if (!COLLECTION_KEYS.has(collectionKey)) return;
    setPendingCollectionPushes(getPendingCollectionPushes().filter(key => key !== collectionKey));
  };

  const hasPendingCollectionPush = collectionKey => getPendingCollectionPushes().includes(collectionKey);

  const readPendingSubscriptionCheckout = () => {
    try {
      const parsed = JSON.parse(getStored(PENDING_SUBSCRIPTION_CHECKOUT_KEY) || "null");
      const accountId = getStored(ACCOUNT_KEY);
      const pendingAccountId = normalizeAccountId(parsed?.accountId);
      const paymentId = normalizePaymentId(parsed?.paymentId);
      const featureKey = normalizePaidFeatureKey(parsed?.featureKey);
      const provider = String(parsed?.provider || "").trim().toLowerCase();

      if (!accountId || pendingAccountId !== accountId || provider !== "yookassa" || !paymentId || !featureKey) {
        return null;
      }

      return {
        accountId: pendingAccountId,
        featureKey,
        provider,
        paymentId,
        checkoutUrl: typeof parsed.checkoutUrl === "string" ? parsed.checkoutUrl : "",
        createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : null,
      };
    } catch {
      return null;
    }
  };

  const storePendingSubscriptionCheckout = checkout => {
    const accountId = normalizeAccountId(checkout?.accountId);
    const paymentId = normalizePaymentId(checkout?.paymentId);
    const featureKey = normalizePaidFeatureKey(checkout?.featureKey);
    const provider = String(checkout?.provider || "").trim().toLowerCase();

    if (!isValidAccountId(accountId) || provider !== "yookassa" || !paymentId || !featureKey) {
      return;
    }

    setStored(PENDING_SUBSCRIPTION_CHECKOUT_KEY, JSON.stringify({
      accountId,
      featureKey,
      provider,
      paymentId,
      checkoutUrl: typeof checkout.checkoutUrl === "string" ? checkout.checkoutUrl : "",
      createdAt: new Date().toISOString(),
    }));
  };

  const clearPendingSubscriptionCheckout = () => {
    removeStored(PENDING_SUBSCRIPTION_CHECKOUT_KEY);
  };

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

  const queuePushSnapshot = (queueKey, pushOperation) => {
    const previousPush = pushQueues.get(queueKey) || Promise.resolve();
    const queuedPush = previousPush.catch(() => null).then(pushOperation);
    const trackedPush = queuedPush.finally(() => {
      if (pushQueues.get(queueKey) === trackedPush) {
        pushQueues.delete(queueKey);
      }
    });
    pushQueues.set(queueKey, trackedPush);
    return trackedPush;
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

  const syncCollectionSnapshot = async ({
    collectionKey,
    localItems,
    revisionKey,
    resultKey,
    getRemote,
    putRemote,
  }) => {
    const items = Array.isArray(localItems) ? localItems : [];
    const localRevision = getRevision(revisionKey);
    const pushLocalSnapshot = async () => {
      try {
        const saved = await putRemote(items);
        setRevision(saved.revision, revisionKey);
        clearPendingCollectionPush(collectionKey);
        return { status: "pushed", [resultKey]: items, revision: saved.revision };
      } catch (error) {
        markPendingCollectionPush(collectionKey);
        throw error;
      }
    };

    try {
      if (hasPendingCollectionPush(collectionKey)) {
        return await pushLocalSnapshot();
      }

      const remote = await getRemote();

      if (remote.revision > localRevision) {
        setRevision(remote.revision, revisionKey);
        return {
          status: "pulled",
          [resultKey]: Array.isArray(remote[resultKey]) ? remote[resultKey] : [],
          revision: remote.revision,
        };
      }

      if (!items.length && remote.revision === 0) {
        return { status: "idle", [resultKey]: items, revision: localRevision };
      }

      return await pushLocalSnapshot();
    } catch {
      return { status: "offline", [resultKey]: items };
    }
  };

  const pushCollectionSnapshot = ({
    collectionKey,
    localItems,
    revisionKey,
    resultKey,
    putRemote,
  }) => {
    const items = Array.isArray(localItems) ? [...localItems] : [];

    return queuePushSnapshot(collectionKey, async () => {
      try {
        const saved = await putRemote(items);
        setRevision(saved.revision, revisionKey);
        clearPendingCollectionPush(collectionKey);
        return { status: "pushed", [resultKey]: items, revision: saved.revision };
      } catch {
        markPendingCollectionPush(collectionKey);
        return { status: "offline", [resultKey]: items };
      }
    });
  };

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

    getPendingSubscriptionCheckout() {
      return readPendingSubscriptionCheckout();
    },

    clearPendingSubscriptionCheckout,

    setAccountId(accountId) {
      const normalizedAccountId = normalizeAccountId(accountId);
      if (!isValidAccountId(normalizedAccountId)) {
        throw new Error("Focus sync account key is invalid.");
      }

      const previousAccountId = getStored(ACCOUNT_KEY);
      if (previousAccountId !== normalizedAccountId) {
        removeStored(PENDING_ACCOUNT_PROFILE_KEY);
        removeStored(PENDING_COLLECTION_PUSHES_KEY);
        removeStored(PENDING_SUBSCRIPTION_CHECKOUT_KEY);
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
      removeStored(PENDING_ACCOUNT_PROFILE_KEY);
      removeStored(PENDING_COLLECTION_PUSHES_KEY);
      removeStored(PENDING_SUBSCRIPTION_CHECKOUT_KEY);
    },

    async disconnectCurrentDevice() {
      const accountId = getStored(ACCOUNT_KEY);
      if (!accountId) {
        return { status: "idle", removedDeviceSessions: 0, removedPushSubscriptions: 0 };
      }

      const deviceId = getDeviceId();

      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/sync/devices/current"), {
          method: "DELETE",
          headers: withAccountHeaders(accountId, deviceId),
        });

        if (response.status === 404) {
          setPendingDeviceDisconnects(getPendingDeviceDisconnects()
            .filter(item => item.accountId !== accountId || item.deviceId !== deviceId));
          return { status: "not-found", removedDeviceSessions: 0, removedPushSubscriptions: 0 };
        }

        if (!response.ok) {
          throw new Error("Focus current device disconnect failed.");
        }

        const result = await response.json();
        setPendingDeviceDisconnects(getPendingDeviceDisconnects()
          .filter(item => item.accountId !== accountId || item.deviceId !== deviceId));
        return {
          status: "removed",
          removedDeviceSessions: result.removedDeviceSessions || 0,
          removedPushSubscriptions: result.removedPushSubscriptions || 0,
        };
      } catch {
        queuePendingDeviceDisconnect({ accountId, deviceId });
        return { status: "offline", removedDeviceSessions: 0, removedPushSubscriptions: 0 };
      }
    },

    async flushPendingDeviceDisconnects() {
      const pending = getPendingDeviceDisconnects();
      if (!pending.length) {
        return { status: "idle", attempted: 0, removed: 0, remaining: 0 };
      }

      const remaining = [];
      let removed = 0;

      for (const item of pending) {
        try {
          const response = await fetchImpl(apiUrl(apiBaseUrl, "/sync/devices/current"), {
            method: "DELETE",
            headers: withAccountHeaders(item.accountId, item.deviceId),
          });

          if (response.status === 404) {
            removed += 1;
            continue;
          }

          if (!response.ok) {
            remaining.push(item);
            continue;
          }

          removed += 1;
        } catch {
          remaining.push(item);
        }
      }

      setPendingDeviceDisconnects(remaining);
      return {
        status: remaining.length ? "pending" : "cleared",
        attempted: pending.length,
        removed,
        remaining: remaining.length,
      };
    },

    getAccountId,
    getDeviceId,
    getDeviceName,

    async checkAccountId(accountId) {
      const normalizedAccountId = normalizeAccountId(accountId);
      if (!isValidAccountId(normalizedAccountId)) {
        return { status: "invalid", accountId: normalizedAccountId };
      }

      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/sync/account"), {
          headers: withAccountHeaders(normalizedAccountId),
        });

        if (response.status === 404) {
          return { status: "not-found", accountId: normalizedAccountId };
        }

        if (!response.ok) {
          throw new Error("Focus sync account check failed.");
        }

        return { status: "ok", ...await response.json() };
      } catch {
        return {
          status: "offline",
          accountId: normalizedAccountId,
          currentDeviceId: getDeviceId(),
          devices: [],
        };
      }
    },

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

    async getAccountEntitlements() {
      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/sync/entitlements"), {
          headers: await withHeaders(),
        });

        if (!response.ok) {
          throw new Error("Focus sync entitlements load failed.");
        }

        const result = await response.json();
        return {
          status: "ok",
          accountId: result.accountId || getStored(ACCOUNT_KEY),
          checkedAt: result.checkedAt || null,
          entitlements: normalizeAccountEntitlements(result.entitlements),
          usage: normalizeAccountFeatureUsage(result.usage),
        };
      } catch {
        return {
          status: "offline",
          accountId: getStored(ACCOUNT_KEY),
          checkedAt: null,
          entitlements: createDefaultAccountEntitlements(),
          usage: createDefaultAccountFeatureUsage(),
        };
      }
    },

    async getEntitlementEvents() {
      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/sync/entitlements/events"), {
          headers: await withHeaders(),
        });

        if (!response.ok) {
          throw new Error("Focus sync entitlement events load failed.");
        }

        const result = await response.json();
        return {
          status: "ok",
          accountId: result.accountId || getStored(ACCOUNT_KEY),
          events: Array.isArray(result.events) ? result.events : [],
        };
      } catch {
        return {
          status: "offline",
          accountId: getStored(ACCOUNT_KEY),
          events: [],
        };
      }
    },

    async getTranscriptionEvents() {
      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/sync/transcription/events"), {
          headers: await withHeaders(),
        });

        if (!response.ok) {
          throw new Error("Focus sync transcription events load failed.");
        }

        const result = await response.json();
        return {
          status: "ok",
          accountId: result.accountId || getStored(ACCOUNT_KEY),
          events: Array.isArray(result.events) ? result.events : [],
        };
      } catch {
        return {
          status: "offline",
          accountId: getStored(ACCOUNT_KEY),
          events: [],
        };
      }
    },

    async getTranscriptionStatus() {
      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/sync/transcription/status"), {
          headers: await withHeaders(),
        });

        if (!response.ok) {
          throw new Error("Focus sync transcription status load failed.");
        }

        const result = await response.json();
        return {
          status: "ok",
          accountId: result.accountId || getStored(ACCOUNT_KEY),
          featureKey: normalizePaidFeatureKey(result.featureKey) || VOICE_TRANSCRIPTION_FEATURE_KEY,
          providerConfigured: result.providerConfigured === true,
          provider: typeof result.provider === "string" && result.provider.trim() ? result.provider.trim() : null,
          providerModel: typeof result.providerModel === "string" && result.providerModel.trim() ? result.providerModel.trim() : null,
          providerTimeoutMs: normalizeNonNegativeInteger(result.providerTimeoutMs),
          monthlyLimit: normalizeNonNegativeInteger(result.monthlyLimit),
          maxDurationMs: normalizeNonNegativeInteger(result.maxDurationMs),
          checkedAt: normalizeIsoTimestamp(result.checkedAt),
        };
      } catch {
        return {
          status: "offline",
          accountId: getStored(ACCOUNT_KEY),
          featureKey: VOICE_TRANSCRIPTION_FEATURE_KEY,
          providerConfigured: false,
          provider: null,
          providerModel: null,
          providerTimeoutMs: 0,
          monthlyLimit: 0,
          maxDurationMs: 0,
          checkedAt: null,
        };
      }
    },

    async transcribeAudio({ audioBase64, mimeType, durationMs = 0, language = "ru-RU", prompt = "" } = {}) {
      const accountId = getStored(ACCOUNT_KEY);
      if (!accountId) {
        return {
          status: "account-required",
          accountId: "",
          featureKey: VOICE_TRANSCRIPTION_FEATURE_KEY,
          text: "",
        };
      }

      const requestBody = normalizeTranscriptionRequest({ audioBase64, mimeType, durationMs, language, prompt });
      if (!requestBody) {
        return {
          status: "invalid-request",
          accountId,
          featureKey: VOICE_TRANSCRIPTION_FEATURE_KEY,
          text: "",
        };
      }

      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/sync/transcription"), {
          method: "POST",
          headers: {
            ...withAccountHeaders(accountId),
            "content-type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });
        const result = await response.json().catch(() => ({}));

        if (response.status === 402 && result?.error === "feature_locked") {
          return {
            status: "locked",
            accountId: result.accountId || accountId,
            featureKey: normalizePaidFeatureKey(result.featureKey) || VOICE_TRANSCRIPTION_FEATURE_KEY,
            text: "",
          };
        }

        if (response.status === 503 && result?.error === "provider_not_configured") {
          return {
            status: "provider-not-configured",
            accountId: result.accountId || accountId,
            featureKey: normalizePaidFeatureKey(result.featureKey) || VOICE_TRANSCRIPTION_FEATURE_KEY,
            provider: typeof result.provider === "string" ? result.provider : null,
            usage: normalizeTranscriptionUsage(result.usage),
            text: "",
          };
        }

        if (response.status === 429 && result?.error === "usage_limit_exceeded") {
          return {
            status: "usage-limit-exceeded",
            accountId: result.accountId || accountId,
            featureKey: normalizePaidFeatureKey(result.featureKey) || VOICE_TRANSCRIPTION_FEATURE_KEY,
            usage: normalizeTranscriptionUsage(result.usage),
            text: "",
          };
        }

        if (response.status === 400) {
          return {
            status: "invalid-request",
            accountId,
            featureKey: VOICE_TRANSCRIPTION_FEATURE_KEY,
            text: "",
          };
        }

        if (!response.ok) {
          throw new Error("Focus transcription request failed.");
        }

        return {
          status: result.status === "transcribed" ? "transcribed" : "failed",
          accountId: result.accountId || accountId,
          featureKey: normalizePaidFeatureKey(result.featureKey) || VOICE_TRANSCRIPTION_FEATURE_KEY,
          provider: typeof result.provider === "string" ? result.provider : null,
          reason: result.status === "transcribed" ? null : normalizeTranscriptionFailureReason(result.reason),
          usage: normalizeTranscriptionUsage(result.usage),
          text: typeof result.text === "string" ? result.text : "",
        };
      } catch {
        return {
          status: "offline",
          accountId,
          featureKey: VOICE_TRANSCRIPTION_FEATURE_KEY,
          text: "",
        };
      }
    },

    async getPersonalScheduleStatus() {
      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/sync/personal-schedule/status"), {
          headers: await withHeaders(),
        });

        if (!response.ok) {
          throw new Error("Focus personal schedule status load failed.");
        }

        const result = await response.json();
        return {
          status: "ok",
          accountId: result.accountId || getStored(ACCOUNT_KEY),
          providerConfigured: result.providerConfigured === true,
          provider: typeof result.provider === "string" ? result.provider : "mock",
          promptVersion: typeof result.promptVersion === "string" ? result.promptVersion : PERSONAL_SCHEDULE_PROMPT_VERSION,
          features: normalizePersonalScheduleFeatures(result.features),
        };
      } catch {
        return {
          status: "offline",
          accountId: getStored(ACCOUNT_KEY),
          providerConfigured: false,
          provider: null,
          promptVersion: PERSONAL_SCHEDULE_PROMPT_VERSION,
          features: normalizePersonalScheduleFeatures(null),
        };
      }
    },

    async generatePersonalSchedule(requestBody = {}) {
      const serializedBody = serializePersonalScheduleRequest(requestBody);
      if (!serializedBody) {
        return {
          status: "invalid-request",
          accountId: getStored(ACCOUNT_KEY),
          promptVersion: PERSONAL_SCHEDULE_PROMPT_VERSION,
          draft: null,
        };
      }

      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/sync/personal-schedule/generate"), {
          method: "POST",
          headers: await withHeaders(),
          body: serializedBody,
        });
        const result = await response.json().catch(() => ({}));

        if (response.status === 400) {
          return {
            status: "invalid-request",
            accountId: result.accountId || getStored(ACCOUNT_KEY),
            promptVersion: result.promptVersion || PERSONAL_SCHEDULE_PROMPT_VERSION,
            errors: Array.isArray(result.errors) ? result.errors : [],
            draft: null,
          };
        }

        if (response.status === 503) {
          return {
            status: "provider-not-configured",
            accountId: result.accountId || getStored(ACCOUNT_KEY),
            provider: typeof result.provider === "string" ? result.provider : null,
            promptVersion: result.promptVersion || PERSONAL_SCHEDULE_PROMPT_VERSION,
            draft: null,
          };
        }

        if (!response.ok) {
          throw new Error("Focus personal schedule generation failed.");
        }

        return {
          status: result.status === "draft_ready" ? "draft_ready" : "generation_failed",
          accountId: result.accountId || getStored(ACCOUNT_KEY),
          provider: typeof result.provider === "string" ? result.provider : "mock",
          promptVersion: result.promptVersion || PERSONAL_SCHEDULE_PROMPT_VERSION,
          draft: result.draft && typeof result.draft === "object" ? result.draft : null,
        };
      } catch {
        return {
          status: "offline",
          accountId: getStored(ACCOUNT_KEY),
          promptVersion: PERSONAL_SCHEDULE_PROMPT_VERSION,
          draft: null,
        };
      }
    },

    async createSubscriptionCheckout({ featureKey } = {}) {
      const normalizedFeatureKey = normalizePaidFeatureKey(featureKey);
      const accountId = getStored(ACCOUNT_KEY);

      if (!accountId) {
        return {
          status: "account-required",
          accountId: "",
          featureKey: normalizedFeatureKey,
          checkoutUrl: null,
        };
      }

      if (!normalizedFeatureKey) {
        return {
          status: "invalid-feature",
          accountId,
          featureKey: "",
          checkoutUrl: null,
        };
      }

      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/sync/checkout"), {
          method: "POST",
          headers: {
            ...withAccountHeaders(accountId),
            "content-type": "application/json",
          },
          body: JSON.stringify({ featureKey: normalizedFeatureKey }),
        });
        const result = await response.json().catch(() => ({}));

        if (response.status === 503 && result?.error === "provider_not_configured") {
          return {
            status: "provider-not-configured",
            accountId: result.accountId || accountId,
            featureKey: normalizePaidFeatureKey(result.featureKey) || normalizedFeatureKey,
            checkoutUrl: null,
          };
        }

        if (response.status === 400) {
          return {
            status: "invalid-feature",
            accountId,
            featureKey: normalizedFeatureKey,
            checkoutUrl: null,
          };
        }

        if (!response.ok) {
          throw new Error("Focus subscription checkout creation failed.");
        }

        const checkout = {
          status: result.status === "ready" && result.checkoutUrl ? "ready" : "failed",
          accountId: result.accountId || accountId,
          featureKey: normalizePaidFeatureKey(result.featureKey) || normalizedFeatureKey,
          checkoutUrl: typeof result.checkoutUrl === "string" ? result.checkoutUrl : null,
          provider: typeof result.provider === "string" ? result.provider : null,
          paymentId: normalizePaymentId(result.paymentId) || null,
        };

        if (checkout.status === "ready" && checkout.provider === "yookassa" && checkout.paymentId) {
          storePendingSubscriptionCheckout(checkout);
        }

        return checkout;
      } catch {
        return {
          status: "offline",
          accountId,
          featureKey: normalizedFeatureKey,
          checkoutUrl: null,
        };
      }
    },

    async getSubscriptionCheckoutStatus({ paymentId } = {}) {
      const accountId = getStored(ACCOUNT_KEY);
      const pendingCheckout = readPendingSubscriptionCheckout();
      const normalizedPaymentId = normalizePaymentId(paymentId) || pendingCheckout?.paymentId || "";

      if (!accountId) {
        return {
          status: "account-required",
          accountId: "",
          featureKey: pendingCheckout?.featureKey || "",
          provider: pendingCheckout?.provider || "yookassa",
          paymentId: normalizedPaymentId || null,
          paymentStatus: null,
          paid: false,
          entitlements: null,
        };
      }

      if (!normalizedPaymentId) {
        clearPendingSubscriptionCheckout();
        return {
          status: "invalid-payment",
          accountId,
          featureKey: pendingCheckout?.featureKey || "",
          provider: pendingCheckout?.provider || "yookassa",
          paymentId: null,
          paymentStatus: null,
          paid: false,
          entitlements: null,
        };
      }

      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, `/sync/checkout/status?paymentId=${encodeURIComponent(normalizedPaymentId)}`), {
          headers: withAccountHeaders(accountId),
        });
        const result = await response.json().catch(() => ({}));

        if (response.status === 503 && result?.error === "provider_not_configured") {
          return {
            status: "provider-not-configured",
            accountId: result.accountId || accountId,
            featureKey: normalizePaidFeatureKey(result.featureKey) || pendingCheckout?.featureKey || "",
            provider: result.provider || pendingCheckout?.provider || "yookassa",
            paymentId: normalizePaymentId(result.paymentId) || normalizedPaymentId,
            paymentStatus: typeof result.paymentStatus === "string" ? result.paymentStatus : null,
            paid: result.paid === true,
            entitlements: null,
          };
        }

        if (response.status === 400) {
          clearPendingSubscriptionCheckout();
          return {
            status: "invalid-payment",
            accountId,
            featureKey: pendingCheckout?.featureKey || "",
            provider: pendingCheckout?.provider || "yookassa",
            paymentId: normalizedPaymentId,
            paymentStatus: null,
            paid: false,
            entitlements: null,
          };
        }

        if (!response.ok) {
          throw new Error("Focus subscription checkout status failed.");
        }

        const checkoutStatus = {
          status: normalizeSubscriptionCheckoutStatus(result.status),
          accountId: result.accountId || accountId,
          featureKey: normalizePaidFeatureKey(result.featureKey) || pendingCheckout?.featureKey || "",
          provider: result.provider || pendingCheckout?.provider || "yookassa",
          paymentId: normalizePaymentId(result.paymentId) || normalizedPaymentId,
          paymentStatus: typeof result.paymentStatus === "string" ? result.paymentStatus : null,
          paid: result.paid === true,
          entitlements: result.entitlements ? normalizeAccountEntitlements(result.entitlements) : null,
        };

        if (["activated", "canceled", "failed", "ignored"].includes(checkoutStatus.status)) {
          clearPendingSubscriptionCheckout();
        }

        return checkoutStatus;
      } catch {
        return {
          status: "offline",
          accountId,
          featureKey: pendingCheckout?.featureKey || "",
          provider: pendingCheckout?.provider || "yookassa",
          paymentId: normalizedPaymentId,
          paymentStatus: null,
          paid: false,
          entitlements: null,
        };
      }
    },

    async updateAccountProfile({ displayName, deviceName } = {}) {
      let accountId = getStored(ACCOUNT_KEY);
      const body = {};
      if (displayName !== undefined) {
        body.displayName = normalizeStoredName(displayName) || "";
      }
      if (deviceName !== undefined) {
        body.deviceName = setDeviceName(deviceName);
      }

      try {
        if (!accountId) {
          accountId = await getAccountId();
        }

        const response = await fetchImpl(apiUrl(apiBaseUrl, "/sync/account"), {
          method: "PATCH",
          headers: withAccountHeaders(accountId),
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error("Focus sync account profile save failed.");
        }

        const result = await response.json();
        removeStored(PENDING_ACCOUNT_PROFILE_KEY);
        return { status: "ok", ...result };
      } catch {
        if (accountId) {
          queuePendingAccountProfileUpdate({
            accountId,
            displayName: body.displayName,
            deviceName: body.deviceName || getDeviceName(),
          });
        }

        return {
          status: "offline",
          accountId,
          displayName: body.displayName || null,
          currentDeviceId: getDeviceId(),
          devices: [{
            deviceId: getDeviceId(),
            deviceName: body.deviceName || getDeviceName(),
            firstSeenAt: null,
            lastSeenAt: null,
            isCurrent: true,
          }],
        };
      }
    },

    async flushPendingAccountProfileUpdate() {
      const pending = getPendingAccountProfileUpdate();
      if (!pending) {
        return { status: "idle" };
      }

      const accountId = getStored(ACCOUNT_KEY);
      if (accountId !== pending.accountId) {
        return { status: "waiting" };
      }

      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/sync/account"), {
          method: "PATCH",
          headers: withAccountHeaders(pending.accountId),
          body: JSON.stringify({
            displayName: pending.displayName,
            deviceName: pending.deviceName || getDeviceName(),
          }),
        });

        if (response.status === 404) {
          removeStored(PENDING_ACCOUNT_PROFILE_KEY);
          return { status: "not-found" };
        }

        if (!response.ok) {
          throw new Error("Focus pending account profile save failed.");
        }

        const result = await response.json();
        removeStored(PENDING_ACCOUNT_PROFILE_KEY);
        return { status: "saved", ...result };
      } catch {
        return { status: "offline" };
      }
    },

    async syncSchedules(localSchedules) {
      return syncCollectionSnapshot({
        collectionKey: "schedules",
        localItems: localSchedules,
        revisionKey: REVISION_KEY,
        resultKey: "schedules",
        getRemote: getRemoteScheduleSnapshot,
        putRemote: putRemoteScheduleSnapshot,
      });
    },

    async pushSchedules(localSchedules) {
      return pushCollectionSnapshot({
        collectionKey: "schedules",
        localItems: localSchedules,
        revisionKey: REVISION_KEY,
        resultKey: "schedules",
        putRemote: putRemoteScheduleSnapshot,
      });
    },

    async syncReminders(localReminders) {
      return syncCollectionSnapshot({
        collectionKey: "reminders",
        localItems: localReminders,
        revisionKey: REMINDERS_REVISION_KEY,
        resultKey: "reminders",
        getRemote: getRemoteReminderSnapshot,
        putRemote: putRemoteReminderSnapshot,
      });
    },

    async pushReminders(localReminders) {
      return pushCollectionSnapshot({
        collectionKey: "reminders",
        localItems: localReminders,
        revisionKey: REMINDERS_REVISION_KEY,
        resultKey: "reminders",
        putRemote: putRemoteReminderSnapshot,
      });
    },

    async syncTasks(localTasks) {
      return syncCollectionSnapshot({
        collectionKey: "tasks",
        localItems: localTasks,
        revisionKey: TASKS_REVISION_KEY,
        resultKey: "tasks",
        getRemote: getRemoteTaskSnapshot,
        putRemote: putRemoteTaskSnapshot,
      });
    },

    async pushTasks(localTasks) {
      return pushCollectionSnapshot({
        collectionKey: "tasks",
        localItems: localTasks,
        revisionKey: TASKS_REVISION_KEY,
        resultKey: "tasks",
        putRemote: putRemoteTaskSnapshot,
      });
    },

    async syncNotes(localNotes) {
      return syncCollectionSnapshot({
        collectionKey: "notes",
        localItems: localNotes,
        revisionKey: NOTES_REVISION_KEY,
        resultKey: "notes",
        getRemote: getRemoteNoteSnapshot,
        putRemote: putRemoteNoteSnapshot,
      });
    },

    async pushNotes(localNotes) {
      return pushCollectionSnapshot({
        collectionKey: "notes",
        localItems: localNotes,
        revisionKey: NOTES_REVISION_KEY,
        resultKey: "notes",
        putRemote: putRemoteNoteSnapshot,
      });
    },

    async syncBirthdays(localBirthdays) {
      return syncCollectionSnapshot({
        collectionKey: "birthdays",
        localItems: localBirthdays,
        revisionKey: BIRTHDAYS_REVISION_KEY,
        resultKey: "birthdays",
        getRemote: getRemoteBirthdaySnapshot,
        putRemote: putRemoteBirthdaySnapshot,
      });
    },

    async pushBirthdays(localBirthdays) {
      return pushCollectionSnapshot({
        collectionKey: "birthdays",
        localItems: localBirthdays,
        revisionKey: BIRTHDAYS_REVISION_KEY,
        resultKey: "birthdays",
        putRemote: putRemoteBirthdaySnapshot,
      });
    },

    async syncDiaryEntries(localEntries) {
      return syncCollectionSnapshot({
        collectionKey: "diary",
        localItems: localEntries,
        revisionKey: DIARY_REVISION_KEY,
        resultKey: "entries",
        getRemote: getRemoteDiarySnapshot,
        putRemote: putRemoteDiarySnapshot,
      });
    },

    async pushDiaryEntries(localEntries) {
      return pushCollectionSnapshot({
        collectionKey: "diary",
        localItems: localEntries,
        revisionKey: DIARY_REVISION_KEY,
        resultKey: "entries",
        putRemote: putRemoteDiarySnapshot,
      });
    },

    async getHolidayProfessionalCategories() {
      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/holiday-calendars/professional-categories"));
        if (!response.ok) {
          throw new Error("Focus holiday professional categories load failed.");
        }

        const result = await response.json();
        return {
          status: "ok",
          selectionModes: Array.isArray(result.selectionModes) ? result.selectionModes : [],
          categories: normalizeHolidayProfessionalCategories(result.categories),
        };
      } catch {
        return {
          status: "offline",
          selectionModes: [
            { code: "none", title: "Не показывать" },
            { code: "all", title: "Показывать все" },
            { code: "selected", title: "Выбрать направления" },
          ],
          categories: normalizeHolidayProfessionalCategories(getBundledProfessionalHolidayCategories()),
        };
      }
    },

    async getHolidayCatalogVersion({ countryCode = "RU", year = new Date().getFullYear() } = {}) {
      const query = createHolidayCatalogQuery(countryCode, year);
      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, `/holiday-calendars/version${query}`));
        if (!response.ok) {
          throw new Error("Focus holiday catalog version load failed.");
        }

        return {
          status: "ok",
          ...normalizeHolidayCatalogVersion(await response.json()),
        };
      } catch {
        return {
          status: "offline",
          ...normalizeHolidayCatalogVersion(getBundledHolidayCatalogVersion({ countryCode, year })),
        };
      }
    },

    async getPublishedHolidayCatalog({ countryCode = "RU", year = new Date().getFullYear() } = {}) {
      const query = createHolidayCatalogQuery(countryCode, year);
      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, `/holiday-calendars/published${query}`));
        if (!response.ok) {
          throw new Error("Focus holiday catalog load failed.");
        }

        return {
          status: "ok",
          catalog: normalizeHolidayCatalogResponse(await response.json()),
        };
      } catch {
        return {
          status: "offline",
          catalog: normalizeHolidayCatalogResponse(getBundledPublishedHolidayCatalog({ countryCode, year })),
        };
      }
    },

    async getHolidayPreferences() {
      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/holiday-preferences"), {
          headers: await withHeaders(),
        });

        if (!response.ok) {
          throw new Error("Focus holiday preferences load failed.");
        }

        const result = await response.json();
        return {
          status: "ok",
          accountId: result.accountId || getStored(ACCOUNT_KEY),
          preferences: normalizeHolidayPreferences(result.preferences),
          checkedAt: normalizeTimestamp(result.checkedAt),
        };
      } catch {
        return {
          status: "offline",
          accountId: getStored(ACCOUNT_KEY),
          preferences: normalizeHolidayPreferences(),
          checkedAt: null,
        };
      }
    },

    async updateHolidayPreferences(preferences = {}) {
      const normalizedPreferences = normalizeHolidayPreferences(preferences);
      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/holiday-preferences"), {
          method: "PUT",
          headers: await withHeaders(),
          body: JSON.stringify(normalizedPreferences),
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          return {
            status: "invalid",
            error: result.error || "invalid_holiday_preferences",
            details: Array.isArray(result.details) ? result.details : [],
          };
        }

        return {
          status: "saved",
          accountId: result.accountId || getStored(ACCOUNT_KEY),
          preferences: normalizeHolidayPreferences(result.preferences),
          checkedAt: normalizeTimestamp(result.checkedAt),
        };
      } catch {
        return {
          status: "offline",
          error: "offline",
          preferences: normalizedPreferences,
        };
      }
    },

    async getQuoteCategories() {
      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/quotes/categories"));
        if (!response.ok) {
          throw new Error("Focus quote categories load failed.");
        }

        const result = await response.json();
        return {
          status: "ok",
          selectionModes: Array.isArray(result.selectionModes) ? result.selectionModes : [],
          categories: normalizeQuoteCategories(result.categories),
        };
      } catch {
        return {
          status: "offline",
          selectionModes: [{ code: "any", titleRu: "Любые" }],
          categories: [],
        };
      }
    },

    async getTodayQuotes({ timezone = getCurrentTimezone() } = {}) {
      const normalizedTimezone = normalizeTimezone(timezone);
      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, `/quotes/today?timezone=${encodeURIComponent(normalizedTimezone)}`), {
          headers: await withHeaders(),
        });
        const result = await response.json().catch(() => ({}));

        if (response.status === 503 && result?.error === "quote_catalog_unavailable") {
          return {
            status: "catalog-unavailable",
            ...normalizeTodayQuotesResponse(result, normalizedTimezone),
          };
        }

        if (!response.ok) {
          throw new Error("Focus daily quotes load failed.");
        }

        return {
          status: "ok",
          ...normalizeTodayQuotesResponse(result, normalizedTimezone),
        };
      } catch {
        return {
          status: "offline",
          ...createEmptyTodayQuotes(normalizedTimezone),
        };
      }
    },

    async getQuotePreferences({ timezone = getCurrentTimezone() } = {}) {
      const normalizedTimezone = normalizeTimezone(timezone);
      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, `/quotes/preferences?timezone=${encodeURIComponent(normalizedTimezone)}`), {
          headers: await withHeaders(),
        });

        if (!response.ok) {
          throw new Error("Focus quote preferences load failed.");
        }

        const result = await response.json();
        return {
          status: "ok",
          accountId: result.accountId || getStored(ACCOUNT_KEY),
          preferences: normalizeQuotePreferences(result.pendingPreferences || result.preferences, normalizedTimezone),
          activePreferences: normalizeQuotePreferences(result.preferences, normalizedTimezone),
          pendingPreferences: result.pendingPreferences
            ? normalizeQuotePreferences(result.pendingPreferences, normalizedTimezone)
            : null,
          checkedAt: normalizeTimestamp(result.checkedAt),
        };
      } catch {
        return {
          status: "offline",
          accountId: getStored(ACCOUNT_KEY),
          preferences: createDefaultQuotePreferences(normalizedTimezone),
          checkedAt: null,
        };
      }
    },

    async updateQuotePreferences(preferences = {}) {
      const normalizedPreferences = normalizeQuotePreferences(preferences, getCurrentTimezone());
      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/quotes/preferences"), {
          method: "PUT",
          headers: await withHeaders(),
          body: JSON.stringify(normalizedPreferences),
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          return {
            status: "invalid",
            error: result.error || "invalid_quote_preferences",
          };
        }

        return {
          status: "saved",
          accountId: result.accountId || getStored(ACCOUNT_KEY),
          preferences: normalizeQuotePreferences(result.preferences, normalizedPreferences.timezone),
          effectiveFromLocalDate: normalizeLocalDate(result.effectiveFromLocalDate),
          message: typeof result.message === "string" ? result.message : "",
          checkedAt: normalizeTimestamp(result.checkedAt),
        };
      } catch {
        return {
          status: "offline",
          error: "offline",
        };
      }
    },

    async favoriteQuote(quoteId) {
      const normalizedQuoteId = normalizeQuoteId(quoteId);
      if (!normalizedQuoteId) {
        return { status: "invalid", quoteId: "", isFavorite: false };
      }

      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, `/quotes/${encodeURIComponent(normalizedQuoteId)}/favorite`), {
          method: "POST",
          headers: await withHeaders(),
          body: "{}",
        });
        if (!response.ok) {
          throw new Error("Focus quote favorite save failed.");
        }
        const result = await response.json();
        return {
          status: "saved",
          quoteId: result.quoteId || normalizedQuoteId,
          isFavorite: result.isFavorite === true,
          createdAt: normalizeTimestamp(result.createdAt),
        };
      } catch {
        return { status: "offline", quoteId: normalizedQuoteId, isFavorite: false };
      }
    },

    async unfavoriteQuote(quoteId) {
      const normalizedQuoteId = normalizeQuoteId(quoteId);
      if (!normalizedQuoteId) {
        return { status: "invalid", quoteId: "", isFavorite: false };
      }

      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, `/quotes/${encodeURIComponent(normalizedQuoteId)}/favorite`), {
          method: "DELETE",
          headers: await withHeaders(),
        });
        if (!response.ok) {
          throw new Error("Focus quote favorite removal failed.");
        }
        const result = await response.json();
        return {
          status: "saved",
          quoteId: result.quoteId || normalizedQuoteId,
          isFavorite: result.isFavorite === true,
        };
      } catch {
        return { status: "offline", quoteId: normalizedQuoteId, isFavorite: true };
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

function serializePersonalScheduleRequest(requestBody) {
  if (!requestBody || typeof requestBody !== "object" || Array.isArray(requestBody)) {
    return "";
  }

  const body = {
    ...requestBody,
    promptVersion: typeof requestBody.promptVersion === "string"
      ? requestBody.promptVersion
      : PERSONAL_SCHEDULE_PROMPT_VERSION,
  };
  let serialized = "";
  try {
    serialized = JSON.stringify(body);
  } catch {
    return "";
  }

  return serialized.length <= MAX_PERSONAL_SCHEDULE_REQUEST_LENGTH ? serialized : "";
}

function normalizePersonalScheduleFeatures(features) {
  const source = features && typeof features === "object" && !Array.isArray(features)
    ? features
    : {};
  const normalizeFlag = (key, fallback) => source[key] === undefined ? fallback : source[key] === true;
  return {
    personal_schedule_quick: normalizeFlag("personal_schedule_quick", true),
    personal_schedule_deep: normalizeFlag("personal_schedule_deep", true),
    personal_schedule_three_variants: normalizeFlag("personal_schedule_three_variants", true),
    personal_schedule_ai_revisions: normalizeFlag("personal_schedule_ai_revisions", false),
    personal_schedule_history: normalizeFlag("personal_schedule_history", true),
    personal_schedule_adaptation: normalizeFlag("personal_schedule_adaptation", false),
  };
}

function createHolidayCatalogQuery(countryCode = "RU", year = new Date().getFullYear()) {
  const country = encodeURIComponent(String(countryCode || "RU").trim().toUpperCase());
  const calendarYear = Math.floor(Number(year)) || new Date().getFullYear();
  return `?country=${country}&year=${encodeURIComponent(String(calendarYear))}`;
}

function normalizeHolidayCatalogVersion(version) {
  const source = version && typeof version === "object" && !Array.isArray(version) ? version : {};
  return {
    countryCode: String(source.countryCode || "").trim().toUpperCase(),
    calendarYear: Math.floor(Number(source.calendarYear) || 0),
    version: Math.floor(Number(source.version) || 0),
    status: String(source.status || "").trim(),
    publishedAt: normalizeTimestamp(source.publishedAt),
    checksum: sanitizeText(source.checksum, 120),
  };
}

function normalizeHolidayCatalogResponse(catalog) {
  const source = catalog && typeof catalog === "object" && !Array.isArray(catalog) ? catalog : {};
  return {
    catalogId: sanitizeText(source.catalogId, 180),
    countryCode: String(source.countryCode || "").trim().toUpperCase(),
    calendarYear: Math.floor(Number(source.calendarYear) || 0),
    version: Math.floor(Number(source.version) || 0),
    status: String(source.status || "").trim(),
    validFromLocalDate: normalizeLocalDate(source.validFromLocalDate),
    validUntilLocalDate: normalizeLocalDate(source.validUntilLocalDate),
    publishedAt: normalizeTimestamp(source.publishedAt),
    checksum: sanitizeText(source.checksum, 120),
    calendars: Array.isArray(source.calendars) ? source.calendars : [],
    events: Array.isArray(source.events) ? source.events : [],
    sources: Array.isArray(source.sources) ? source.sources : [],
    professionalCategories: normalizeHolidayProfessionalCategories(source.professionalCategories),
    changeLog: Array.isArray(source.changeLog) ? source.changeLog : [],
  };
}

function normalizeHolidayProfessionalCategories(categories) {
  return Array.isArray(categories)
    ? categories
      .map(category => {
        const source = category && typeof category === "object" && !Array.isArray(category) ? category : {};
        const code = String(source.code || "").trim();
        const title = sanitizeText(source.title || source.titleRu, 160);
        return code && title ? {
          code,
          title,
          sortOrder: Math.floor(Number(source.sortOrder) || 0),
        } : null;
      })
      .filter(Boolean)
    : [];
}

function encodeHeaderValue(value) {
  return encodeURIComponent(String(value || ""));
}

function normalizeStoredName(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
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

function createDefaultAccountFeatureUsage() {
  return {
    voiceTranscription: null,
  };
}

function normalizeAccountEntitlements(entitlements) {
  const source = entitlements && typeof entitlements === "object" && !Array.isArray(entitlements)
    ? entitlements
    : {};
  return {
    voiceTranscription: normalizeFeatureEntitlement(source.voiceTranscription ?? source.voice_transcription),
  };
}

function normalizeAccountFeatureUsage(usage) {
  const source = usage && typeof usage === "object" && !Array.isArray(usage)
    ? usage
    : {};

  return {
    voiceTranscription: normalizeTranscriptionUsage(source.voiceTranscription ?? source.voice_transcription),
  };
}

function normalizeFeatureEntitlement(entitlement) {
  if (entitlement === true) {
    return {
      enabled: true,
      source: "manual",
      updatedAt: null,
      activatedAt: null,
      expiresAt: null,
      paymentId: null,
    };
  }

  if (!entitlement || typeof entitlement !== "object" || Array.isArray(entitlement) || entitlement.enabled !== true) {
    return {
      enabled: false,
      source: normalizeEntitlementSource(entitlement?.source) || "none",
      updatedAt: normalizeTimestamp(entitlement?.updatedAt),
      activatedAt: normalizeTimestamp(entitlement?.activatedAt),
      expiresAt: normalizeTimestamp(entitlement?.expiresAt),
      paymentId: normalizePaymentId(entitlement?.paymentId) || null,
    };
  }

  return {
    enabled: true,
    source: normalizeEntitlementSource(entitlement.source) || "manual",
    updatedAt: normalizeTimestamp(entitlement.updatedAt),
    activatedAt: normalizeTimestamp(entitlement.activatedAt),
    expiresAt: normalizeTimestamp(entitlement.expiresAt),
    paymentId: normalizePaymentId(entitlement.paymentId) || null,
  };
}

function normalizeTodayQuotesResponse(result, timezone = "UTC") {
  const source = result && typeof result === "object" && !Array.isArray(result) ? result : {};
  return {
    localDate: normalizeLocalDate(source.localDate),
    timezone: normalizeTimezone(source.timezone || timezone),
    validFromUtc: normalizeTimestamp(source.validFromUtc),
    validUntilUtc: normalizeTimestamp(source.validUntilUtc),
    generationReason: normalizeQuoteGenerationReason(source.generationReason),
    quotes: normalizeDailyQuotes(source.quotes),
  };
}

function createEmptyTodayQuotes(timezone = "UTC") {
  return {
    localDate: "",
    timezone: normalizeTimezone(timezone),
    validFromUtc: null,
    validUntilUtc: null,
    generationReason: "",
    quotes: [],
  };
}

function normalizeDailyQuotes(quotes) {
  return Array.isArray(quotes)
    ? quotes.map(normalizeDailyQuote).filter(Boolean).sort((first, second) => first.position - second.position).slice(0, 5)
    : [];
}

function normalizeDailyQuote(quote) {
  if (!quote || typeof quote !== "object" || Array.isArray(quote)) {
    return null;
  }

  const id = normalizeQuoteIdValue(quote.id);
  const text = sanitizeText(quote.text, 2000);
  const authorName = sanitizeText(quote.authorName, 160);
  const sourceTitle = sanitizeText(quote.sourceTitle, 500);
  const sourceReference = sanitizeText(quote.sourceReference, 500);
  if (!id || !text || !authorName || !sourceTitle || !sourceReference) {
    return null;
  }

  return {
    id,
    position: Math.max(1, Math.min(5, Math.floor(Number(quote.position) || 1))),
    text,
    authorName,
    sourceTitle,
    sourceType: sanitizeQuoteSourceType(quote.sourceType),
    sourceReference,
    sourceUrl: typeof quote.sourceUrl === "string" ? quote.sourceUrl : "",
    categoryCodes: normalizeQuoteCategoryCodes(quote.categoryCodes),
    isFavorite: quote.isFavorite === true,
  };
}

function normalizeQuoteCategories(categories) {
  return Array.isArray(categories)
    ? categories.map(normalizeQuoteCategory).filter(Boolean)
    : [];
}

function normalizeQuoteCategory(category) {
  if (!category || typeof category !== "object" || Array.isArray(category)) {
    return null;
  }

  const code = normalizeQuoteCategoryCode(category.code);
  const titleRu = sanitizeText(category.titleRu, 120);
  if (!code || !titleRu) {
    return null;
  }

  return {
    id: normalizeQuoteIdValue(category.id) || `quote-category-${code}`,
    code,
    titleRu,
    descriptionRu: sanitizeText(category.descriptionRu, 500),
    sortOrder: Number(category.sortOrder) || 0,
    isActive: category.isActive !== false,
    minimumCatalogSize: Math.max(0, Math.floor(Number(category.minimumCatalogSize) || 0)),
    activeVerifiedCount: Math.max(0, Math.floor(Number(category.activeVerifiedCount) || 0)),
    available: category.available === true,
  };
}

function normalizeQuotePreferences(preferences, timezone = "UTC") {
  const source = preferences && typeof preferences === "object" && !Array.isArray(preferences)
    ? preferences
    : {};
  const selectedCategoryCodes = normalizeQuoteCategoryCodes(source.selectedCategoryCodes).slice(0, 3);
  const selectionMode = source.selectionMode === "selected_categories" && selectedCategoryCodes.length
    ? "selected_categories"
    : "any";

  return {
    selectionMode,
    selectedCategoryCodes: selectionMode === "selected_categories" ? selectedCategoryCodes : [],
    timezone: normalizeTimezone(source.timezone || timezone),
    language: "ru",
    excludeReligiousQuotes: source.excludeReligiousQuotes === true,
    excludePoliticalQuotes: source.excludePoliticalQuotes === true,
    excludeSadQuotes: source.excludeSadQuotes === true,
    effectiveFromLocalDate: normalizeLocalDate(source.effectiveFromLocalDate),
  };
}

function createDefaultQuotePreferences(timezone = "UTC") {
  return {
    selectionMode: "any",
    selectedCategoryCodes: [],
    timezone: normalizeTimezone(timezone),
    language: "ru",
    excludeReligiousQuotes: false,
    excludePoliticalQuotes: false,
    excludeSadQuotes: false,
    effectiveFromLocalDate: "",
  };
}

function normalizeQuoteCategoryCodes(value) {
  const seen = new Set();
  return Array.isArray(value)
    ? value.map(normalizeQuoteCategoryCode).filter(code => code && !seen.has(code) && seen.add(code))
    : [];
}

function normalizeQuoteCategoryCode(value) {
  const code = String(value || "").trim();
  return QUOTE_CATEGORY_PATTERN.test(code) ? code : "";
}

function normalizeQuoteIdValue(value) {
  const quoteId = String(value || "").trim();
  return QUOTE_ID_PATTERN.test(quoteId) ? quoteId : "";
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

function normalizeQuoteGenerationReason(value) {
  const reason = String(value || "").trim();
  return ["scheduled_midnight", "recovery_fallback", "admin_rebuild"].includes(reason) ? reason : "";
}

function normalizeLocalDate(value) {
  const date = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function normalizeTimezone(value) {
  const timezone = String(value || "UTC").trim();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return "UTC";
  }
}

function sanitizeText(value, maxLength = 500) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function normalizeTimestamp(value) {
  const timestamp = String(value || "").trim();
  if (!timestamp) return null;

  const time = Date.parse(timestamp);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function normalizeEntitlementSource(value) {
  const source = String(value || "").trim();
  return ENTITLEMENT_SOURCE_PATTERN.test(source) ? source : "";
}

function normalizePaymentId(value) {
  const paymentId = String(value || "").trim();
  return PAYMENT_ID_PATTERN.test(paymentId) ? paymentId : "";
}

function normalizePaidFeatureKey(value) {
  const featureKey = String(value || "").trim();
  if (featureKey === "voice_transcription") {
    return VOICE_TRANSCRIPTION_FEATURE_KEY;
  }
  return PAID_FEATURE_KEYS.has(featureKey) ? featureKey : "";
}

function normalizeTranscriptionRequest({ audioBase64, mimeType, durationMs, language, prompt } = {}) {
  const normalizedAudio = normalizeTranscriptionAudioBase64(audioBase64);
  const normalizedMimeType = normalizeTranscriptionMimeType(mimeType);
  const normalizedDurationMs = normalizeTranscriptionDurationMs(durationMs);

  if (!normalizedAudio || !normalizedMimeType || normalizedDurationMs === null) {
    return null;
  }

  return {
    audioBase64: normalizedAudio,
    mimeType: normalizedMimeType,
    durationMs: normalizedDurationMs,
    language: normalizeTranscriptionLanguage(language),
    prompt: sanitizeTranscriptionPrompt(prompt),
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

function normalizeTranscriptionUsage(usage) {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
    return null;
  }

  const period = String(usage.period || "").trim();
  const used = normalizeNonNegativeInteger(usage.used);
  const limit = normalizeNonNegativeInteger(usage.limit);
  const remaining = normalizeNonNegativeInteger(usage.remaining);
  const resetAt = normalizeIsoTimestamp(usage.resetAt);
  const updatedAt = normalizeIsoTimestamp(usage.updatedAt);

  if (!/^\d{4}-\d{2}$/.test(period) || !limit) {
    return null;
  }

  return {
    period,
    used,
    limit,
    remaining,
    resetAt,
    updatedAt,
  };
}

function normalizeTranscriptionFailureReason(value) {
  const reason = String(value || "").trim();
  return /^[a-z][a-z0-9_:-]{0,80}$/.test(reason) ? reason : null;
}

function normalizeNonNegativeInteger(value) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeIsoTimestamp(value) {
  const timestamp = String(value || "").trim();
  if (!timestamp) return null;

  const time = Date.parse(timestamp);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
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
  const normalizedMimeType = String(value || "").split(";")[0].trim().toLowerCase();
  return TRANSCRIPTION_MIME_TYPES.has(normalizedMimeType) ? normalizedMimeType : "";
}

function normalizeTranscriptionLanguage(value) {
  const normalizedLanguage = String(value || "").trim();
  return /^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})?$/.test(normalizedLanguage)
    ? normalizedLanguage
    : "ru-RU";
}

function sanitizeTranscriptionPrompt(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 500);
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
