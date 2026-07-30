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
const COLLECTION_KEYS = new Set(["schedules", "reminders", "tasks", "notes", "birthdays", "diary"]);
const ENTITLEMENT_SOURCE_PATTERN = /^[a-zA-Z0-9_.:-]{1,80}$/;
const PAID_FEATURE_KEYS = new Set(["voiceTranscription"]);

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
        };
      } catch {
        return {
          status: "offline",
          accountId: getStored(ACCOUNT_KEY),
          checkedAt: null,
          entitlements: createDefaultAccountEntitlements(),
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

function createDefaultAccountEntitlements() {
  return {
    voiceTranscription: {
      enabled: false,
      source: "none",
      updatedAt: null,
    },
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

function normalizeFeatureEntitlement(entitlement) {
  if (entitlement === true) {
    return {
      enabled: true,
      source: "manual",
      updatedAt: null,
    };
  }

  if (!entitlement || typeof entitlement !== "object" || Array.isArray(entitlement) || entitlement.enabled !== true) {
    return {
      enabled: false,
      source: "none",
      updatedAt: null,
    };
  }

  const source = String(entitlement.source || "").trim();
  return {
    enabled: true,
    source: ENTITLEMENT_SOURCE_PATTERN.test(source) ? source : "manual",
    updatedAt: typeof entitlement.updatedAt === "string" ? entitlement.updatedAt : null,
  };
}

function normalizePaidFeatureKey(value) {
  const featureKey = String(value || "").trim();
  if (featureKey === "voice_transcription") {
    return "voiceTranscription";
  }
  return PAID_FEATURE_KEYS.has(featureKey) ? featureKey : "";
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
