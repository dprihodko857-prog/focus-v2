import assert from "node:assert/strict";
import { test } from "node:test";

import { createFocusSyncClient } from "../public/js/sync.js";
import { createFocusSyncServer, createSyncDatabase } from "../server/sync-server.mjs";

test("holiday catalog endpoints expose the published RU 2026 catalog without account data", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({ db });
  const baseUrl = await listen(server);

  try {
    const versionResponse = await fetch(`${baseUrl}/api/holiday-calendars/version?country=RU&year=2026`);
    assert.equal(versionResponse.status, 200);
    const version = await versionResponse.json();
    assert.equal(version.countryCode, "RU");
    assert.equal(version.calendarYear, 2026);
    assert.equal(version.status, "published");
    assert.match(version.checksum, /^fnv1a-[0-9a-f]{8}$/);

    const catalogResponse = await fetch(`${baseUrl}/api/holiday-calendars/published?country=RU&year=2026`);
    assert.equal(catalogResponse.status, 200);
    const catalog = await catalogResponse.json();
    assert.equal(catalog.status, "published");
    assert.ok(catalog.events.some(event => event.id === "ru-2026-public-day-off-jan-09"));
    assert.ok(catalog.calendars.some(calendar => calendar.calendarKind === "religious"));

    const categoriesResponse = await fetch(`${baseUrl}/api/holiday-calendars/professional-categories`);
    assert.equal(categoriesResponse.status, 200);
    const categories = await categoriesResponse.json();
    assert.ok(categories.categories.some(category => category.code === "it_telecom"));
    assert.ok(categories.selectionModes.some(mode => mode.code === "selected"));
  } finally {
    await close(server);
    db.close();
  }
});

test("holiday preferences store only server-safe fields", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    now: () => "2026-08-04T09:00:00.000Z",
  });
  const baseUrl = await listen(server);

  try {
    const accountResponse = await fetch(`${baseUrl}/api/sync/accounts`, { method: "POST" });
    const { accountId } = await accountResponse.json();

    const initialResponse = await fetch(`${baseUrl}/api/holiday-preferences`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
    });
    assert.equal(initialResponse.status, 200);
    const initial = await initialResponse.json();
    assert.equal(initial.preferences.setupCompleted, false);
    assert.equal(Object.hasOwn(initial.preferences, "selectedTraditions"), false);

    const saveResponse = await fetch(`${baseUrl}/api/holiday-preferences`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify({
        countryCode: "RU",
        publicHolidaysEnabled: true,
        workingDayOverridesEnabled: true,
        professionalMode: "selected",
        professionalCategoryCodes: ["it_telecom"],
        selectedTraditions: ["islamic"],
        religiousTraditions: ["orthodox"],
      }),
    });

    assert.equal(saveResponse.status, 200);
    const saved = await saveResponse.json();
    assert.equal(saved.status, "saved");
    assert.equal(saved.preferences.setupCompleted, true);
    assert.deepEqual(saved.preferences.professionalCategoryCodes, ["it_telecom"]);
    assert.equal(Object.hasOwn(saved.preferences, "selectedTraditions"), false);
    assert.equal(Object.hasOwn(saved.preferences, "religiousTraditions"), false);

    const stored = db.getUserHolidayPreferences(accountId);
    assert.equal(Object.hasOwn(stored, "selectedTraditions"), false);
    assert.equal(Object.hasOwn(stored, "religiousTraditions"), false);

    const refreshedResponse = await fetch(`${baseUrl}/api/holiday-preferences`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "phone",
      },
    });
    const refreshed = await refreshedResponse.json();
    assert.equal(refreshed.preferences.setupCompleted, true);
    assert.equal(Object.hasOwn(refreshed.preferences, "selectedTraditions"), false);
  } finally {
    await close(server);
    db.close();
  }
});

test("sync client strips religious fields before updating holiday preferences", async () => {
  const calls = [];
  const client = createFocusSyncClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      return jsonResponse({
        status: "saved",
        accountId: "account-1",
        preferences: {
          ...JSON.parse(options.body),
          setupCompleted: true,
          updatedAt: "2026-08-04T09:00:00.000Z",
        },
        checkedAt: "2026-08-04T09:00:00.000Z",
      });
    },
    localStorage: createMemoryLocalStorage({
      "focus-sync-account-id": "account-1",
      "focus-sync-device-id": "device-1",
    }),
    randomUUID: () => "device-1",
  });

  const result = await client.updateHolidayPreferences({
    countryCode: "RU",
    publicHolidaysEnabled: true,
    workingDayOverridesEnabled: true,
    professionalMode: "selected",
    professionalCategoryCodes: ["it_telecom"],
    selectedTraditions: ["islamic"],
    religiousTraditions: ["orthodox"],
  });

  const body = JSON.parse(calls[0].options.body);
  assert.equal(calls[0].url, "/api/holiday-preferences");
  assert.equal(calls[0].options.method, "PUT");
  assert.equal(calls[0].options.headers["x-focus-account"], "account-1");
  assert.equal(Object.hasOwn(body, "selectedTraditions"), false);
  assert.equal(Object.hasOwn(body, "religiousTraditions"), false);
  assert.equal(result.status, "saved");
  assert.deepEqual(result.preferences.professionalCategoryCodes, ["it_telecom"]);
});

function listen(server) {
  return new Promise(resolve => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server) {
  return new Promise(resolve => server.close(resolve));
}

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
