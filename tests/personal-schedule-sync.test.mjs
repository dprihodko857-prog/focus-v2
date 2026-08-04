import assert from "node:assert/strict";
import http from "node:http";
import { test } from "node:test";

import { createFocusSyncClient } from "../public/js/sync.js";
import {
  PERSONAL_SCHEDULE_PROMPT_VERSION,
  createDefaultPersonalScheduleIntake,
  createPersonalScheduleAiRequest,
} from "../public/js/personal-schedule-planner.js";
import { createFocusSyncServer, createSyncDatabase } from "../server/sync-server.mjs";

test("sync client generates personal schedule through backend account endpoint", async () => {
  const calls = [];
  const storage = createMemoryLocalStorage();
  const client = createFocusSyncClient({
    localStorage: storage,
    randomUUID: () => "device-personal-schedule",
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      if (url === "/api/sync/accounts") {
        return jsonResponse({ accountId: "account-personal-schedule" }, 201);
      }
      if (url === "/api/sync/personal-schedule/generate") {
        assert.equal(options.headers["x-focus-account"], "account-personal-schedule");
        assert.equal(options.headers["x-focus-device"], "device-personal-schedule");
        const body = JSON.parse(options.body);
        assert.equal(body.promptVersion, PERSONAL_SCHEDULE_PROMPT_VERSION);
        return jsonResponse({
          status: "draft_ready",
          provider: "mock",
          promptVersion: PERSONAL_SCHEDULE_PROMPT_VERSION,
          draft: { id: "draft-1", variants: [{ id: "variant-1", blocks: [] }] },
        });
      }
      return jsonResponse({ error: "not_found" }, 404);
    },
  });

  const result = await client.generatePersonalSchedule(createPersonalScheduleAiRequest({
    intake: createDefaultPersonalScheduleIntake(),
  }));

  assert.equal(result.status, "draft_ready");
  assert.equal(result.provider, "mock");
  assert.equal(result.draft.id, "draft-1");
  assert.deepEqual(calls.map(call => call.url), ["/api/sync/accounts", "/api/sync/personal-schedule/generate"]);
});

test("sync API exposes personal schedule status and structured mock generation", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    now: () => "2026-08-04T09:00:00.000Z",
    createId: () => "stable-id",
  });
  const baseUrl = await listen(server);

  try {
    const accountResponse = await fetch(`${baseUrl}/api/sync/accounts`, { method: "POST" });
    const account = await accountResponse.json();

    const statusResponse = await fetch(`${baseUrl}/api/sync/personal-schedule/status`, {
      headers: {
        "x-focus-account": account.accountId,
        "x-focus-device": "desktop",
      },
    });
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json();
    assert.equal(status.provider, "mock");
    assert.equal(status.providerConfigured, true);
    assert.equal(status.promptVersion, PERSONAL_SCHEDULE_PROMPT_VERSION);
    assert.equal(status.features.personal_schedule_quick, true);

    const generateResponse = await fetch(`${baseUrl}/api/sync/personal-schedule/generate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-account": account.accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify(createPersonalScheduleAiRequest({
        intake: { ...createDefaultPersonalScheduleIntake(), mode: "deep" },
      })),
    });
    assert.equal(generateResponse.status, 200);
    const generated = await generateResponse.json();
    assert.equal(generated.status, "draft_ready");
    assert.equal(generated.draft.variants.length, 3);
    assert.equal(generated.draft.promptVersion, PERSONAL_SCHEDULE_PROMPT_VERSION);
  } finally {
    await close(server);
    db.close();
  }
});

test("sync API rejects personal schedule generation without account", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({ db });
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/sync/personal-schedule/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(createPersonalScheduleAiRequest({
        intake: createDefaultPersonalScheduleIntake(),
      })),
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "account_required");
  } finally {
    await close(server);
    db.close();
  }
});

function createMemoryLocalStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: key => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
  };
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

function listen(server) {
  return new Promise(resolve => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}
