import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

import { createFocusSyncServer, createSyncDatabase, dispatchDueReminders, runBackgroundReminderDispatch } from "../server/sync-server.mjs";

test("sync API creates an account and shares schedules across devices", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({ db });
  const baseUrl = await listen(server);

  try {
    const accountResponse = await fetch(`${baseUrl}/api/sync/accounts`, { method: "POST" });
    assert.equal(accountResponse.status, 201);

    const account = await accountResponse.json();
    assert.match(account.accountId, /^[0-9a-f-]{36}$/);

    const schedules = [{ id: "school", title: "School schedule", role: "participant" }];
    const putResponse = await fetch(`${baseUrl}/api/sync/schedules`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-focus-account": account.accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify({ schedules }),
    });

    assert.equal(putResponse.status, 200);
    assert.equal((await putResponse.json()).revision, 1);

    const getResponse = await fetch(`${baseUrl}/api/sync/schedules`, {
      headers: {
        "x-focus-account": account.accountId,
        "x-focus-device": "phone",
      },
    });

    assert.equal(getResponse.status, 200);
    const snapshot = await getResponse.json();
    assert.equal(snapshot.accountId, account.accountId);
    assert.equal(snapshot.revision, 1);
    assert.deepEqual(snapshot.schedules, schedules);
    assert.match(snapshot.updatedAt, /\d{4}-\d{2}-\d{2}T/);
  } finally {
    await close(server);
    db.close();
  }
});

test("sync API rejects schedule reads without an account key", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({ db });
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/sync/schedules`);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "account_required");
  } finally {
    await close(server);
    db.close();
  }
});

test("sync API CORS preflight allows current device disconnect", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({ db });
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/sync/devices/current`, {
      method: "OPTIONS",
      headers: {
        "access-control-request-method": "DELETE",
      },
    });

    assert.equal(response.status, 204);
    assert.match(response.headers.get("access-control-allow-methods") || "", /\bDELETE\b/);
  } finally {
    await close(server);
    db.close();
  }
});

test("sync API rejects unknown account keys without creating accounts", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({ db });
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/sync/schedules`, {
      headers: {
        "x-focus-account": "missing-account",
        "x-focus-device": "desktop",
      },
    });

    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, "account_not_found");
    assert.equal(db.getAccount("missing-account"), null);
    assert.equal(db.getScheduleSnapshot("missing-account"), null);
  } finally {
    await close(server);
    db.close();
  }
});

test("sync API reports malformed JSON request bodies as client errors", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({ db });
  const baseUrl = await listen(server);
  const accountId = "account-invalid-json";
  createTestAccount(db, accountId);

  try {
    const response = await fetch(`${baseUrl}/api/sync/schedules`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: "{ not valid json",
    });

    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "invalid_json");
    assert.equal(db.getScheduleSnapshot(accountId), null);
  } finally {
    await close(server);
    db.close();
  }
});

test("sync API reports oversized JSON request bodies as client errors", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({ db });
  const baseUrl = await listen(server);
  const accountId = "account-large-json";
  createTestAccount(db, accountId);

  try {
    const response = await fetch(`${baseUrl}/api/sync/schedules`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify({ schedules: [{ id: "large", title: "x".repeat(1024 * 1024) }] }),
    });

    assert.equal(response.status, 413);
    assert.equal((await response.json()).error, "request_body_too_large");
    assert.equal(db.getScheduleSnapshot(accountId), null);
  } finally {
    await close(server);
    db.close();
  }
});

test("sync API enforces oversized JSON limits by byte size", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({ db });
  const baseUrl = await listen(server);
  const accountId = "account-large-unicode-json";
  const body = JSON.stringify({ schedules: [{ id: "large-unicode", title: "Ж".repeat(600 * 1024) }] });
  createTestAccount(db, accountId);

  assert.ok(body.length < 1024 * 1024);
  assert.ok(Buffer.byteLength(body) > 1024 * 1024);

  try {
    const response = await fetch(`${baseUrl}/api/sync/schedules`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body,
    });

    assert.equal(response.status, 413);
    assert.equal((await response.json()).error, "request_body_too_large");
    assert.equal(db.getScheduleSnapshot(accountId), null);
  } finally {
    await close(server);
    db.close();
  }
});

test("auth API reports Orbit Auth configuration state", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    authConfig: {
      issuer: "https://auth.dmnao83.ru",
      authorizationEndpoint: "https://auth.dmnao83.ru/oauth/authorize",
      tokenEndpoint: "https://auth.dmnao83.ru/oauth/token",
      userinfoEndpoint: "https://auth.dmnao83.ru/userinfo",
      clientId: "",
      clientSecret: "",
      redirectUri: "https://focus-v2.dmnao83.ru/api/auth/callback",
      scope: "openid email profile offline_access",
    },
  });
  const baseUrl = await listen(server);

  try {
    const sessionResponse = await fetch(`${baseUrl}/api/auth/session`);
    assert.equal(sessionResponse.status, 200);
    assert.deepEqual(await sessionResponse.json(), {
      configured: false,
      issuer: "https://auth.dmnao83.ru",
      redirectUri: "https://focus-v2.dmnao83.ru/api/auth/callback",
      scope: "openid email profile offline_access",
      authenticated: false,
      accountId: null,
      user: null,
    });

    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, { redirect: "manual" });
    assert.equal(loginResponse.status, 503);
    assert.equal((await loginResponse.json()).error, "auth_not_configured");
  } finally {
    await close(server);
    db.close();
  }
});

test("auth API completes Orbit Auth code flow and exposes a local session", async () => {
  const db = createSyncDatabase(":memory:");
  const authRequests = [];
  const issuerServer = http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    authRequests.push({ method: request.method, pathname: url.pathname, headers: request.headers });

    if (request.method === "POST" && url.pathname === "/oauth/token") {
      const body = new URLSearchParams(await readBody(request));
      assert.equal(body.get("grant_type"), "authorization_code");
      assert.equal(body.get("code"), "auth-code");
      assert.equal(body.get("client_id"), "focus-test-client");
      assert.equal(Boolean(body.get("code_verifier")), true);
      sendTestJson(response, 200, { access_token: "access-token", token_type: "Bearer", expires_in: 3600 });
      return;
    }

    if (request.method === "GET" && url.pathname === "/userinfo") {
      assert.equal(request.headers.authorization, "Bearer access-token");
      sendTestJson(response, 200, {
        sub: "orbit-user-1",
        email: "user@example.test",
        name: "Григорий",
      });
      return;
    }

    sendTestJson(response, 404, { error: "not_found" });
  });
  const issuerBaseUrl = await listen(issuerServer);
  const authConfig = {
    issuer: issuerBaseUrl,
    authorizationEndpoint: `${issuerBaseUrl}/oauth/authorize`,
    tokenEndpoint: `${issuerBaseUrl}/oauth/token`,
    userinfoEndpoint: `${issuerBaseUrl}/userinfo`,
    clientId: "focus-test-client",
    clientSecret: "",
    redirectUri: "",
    scope: "openid email profile offline_access",
  };
  const server = createFocusSyncServer({
    db,
    authConfig,
    now: () => "2026-07-12T10:00:00.000Z",
  });
  const baseUrl = await listen(server);
  authConfig.redirectUri = `${baseUrl}/api/auth/callback`;

  try {
    const loginResponse = await fetch(`${baseUrl}/api/auth/login?returnTo=%2F`, {
      redirect: "manual",
      headers: {
        host: "focus-v2.dmnao83.ru",
        "x-forwarded-proto": "https",
      },
    });
    assert.equal(loginResponse.status, 302);

    const authorizeUrl = new URL(loginResponse.headers.get("location"));
    assert.equal(authorizeUrl.origin, issuerBaseUrl);
    assert.equal(authorizeUrl.pathname, "/oauth/authorize");
    assert.equal(authorizeUrl.searchParams.get("client_id"), "focus-test-client");
    assert.equal(authorizeUrl.searchParams.get("redirect_uri"), `${baseUrl}/api/auth/callback`);
    assert.equal(authorizeUrl.searchParams.get("code_challenge_method"), "S256");
    assert.equal(Boolean(authorizeUrl.searchParams.get("code_challenge")), true);

    const transientCookie = loginResponse.headers.get("set-cookie").split(";")[0];
    const callbackResponse = await fetch(`${baseUrl}/api/auth/callback?code=auth-code&state=${authorizeUrl.searchParams.get("state")}`, {
      redirect: "manual",
      headers: {
        cookie: transientCookie,
        host: "focus-v2.dmnao83.ru",
        "x-forwarded-proto": "https",
      },
    });
    assert.equal(callbackResponse.status, 302);
    assert.equal(callbackResponse.headers.get("location"), "/");
    const setCookieHeader = callbackResponse.headers.get("set-cookie");
    assert.match(setCookieHeader, /focus_auth_session=/);
    assert.match(setCookieHeader, /focus_auth_pkce=.*Max-Age=0/);

    const sessionCookie = setCookieHeader
      .split(",")
      .map(cookie => cookie.trim())
      .find(cookie => cookie.startsWith("focus_auth_session="))
      .split(";")[0];
    const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { cookie: sessionCookie },
    });

    assert.equal(sessionResponse.status, 200);
    const session = await sessionResponse.json();
    assert.equal(session.configured, true);
    assert.equal(session.authenticated, true);
    assert.match(session.accountId, /^orbit:[a-f0-9]{32}$/);
    assert.deepEqual(session.user, {
      sub: "orbit-user-1",
      email: "user@example.test",
      name: "Григорий",
      preferredUsername: null,
      picture: null,
    });
    assert.equal(db.getAccount(session.accountId).displayName, "Григорий");
    assert.equal(authRequests.some(request => request.pathname === "/oauth/token"), true);
    assert.equal(authRequests.some(request => request.pathname === "/userinfo"), true);
  } finally {
    await close(server);
    await close(issuerServer);
    db.close();
  }
});

test("sync account profile tracks account and device metadata", async () => {
  const db = createSyncDatabase(":memory:");
  const ticks = [
    "2026-07-12T08:00:00.000Z",
    "2026-07-12T08:05:00.000Z",
    "2026-07-12T08:10:00.000Z",
  ];
  let tickIndex = 0;
  const server = createFocusSyncServer({
    db,
    now: () => ticks[Math.min(tickIndex++, ticks.length - 1)],
  });
  const baseUrl = await listen(server);
  const accountId = "account-profile";
  createTestAccount(db, accountId, ticks[0]);

  try {
    const profileResponse = await fetch(`${baseUrl}/api/sync/account`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
        "x-focus-device-name": encodeURIComponent("Ноутбук"),
      },
    });

    assert.equal(profileResponse.status, 200);
    assert.deepEqual(await profileResponse.json(), {
      accountId,
      displayName: null,
      createdAt: ticks[0],
      updatedAt: ticks[0],
      currentDeviceId: "desktop",
      devices: [{
        deviceId: "desktop",
        deviceName: "Ноутбук",
        firstSeenAt: ticks[0],
        lastSeenAt: ticks[0],
        isCurrent: true,
      }],
    });

    const updateResponse = await fetch(`${baseUrl}/api/sync/account`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
        "x-focus-device-name": encodeURIComponent("Ноутбук"),
      },
      body: JSON.stringify({
        displayName: "Личный фокус",
        deviceName: "Рабочий ноутбук",
      }),
    });

    assert.equal(updateResponse.status, 200);
    const updatedProfile = await updateResponse.json();
    assert.equal(updatedProfile.displayName, "Личный фокус");
    assert.equal(updatedProfile.updatedAt, ticks[1]);
    assert.equal(updatedProfile.devices[0].deviceName, "Рабочий ноутбук");
    assert.equal(updatedProfile.devices[0].lastSeenAt, ticks[1]);

    const phoneResponse = await fetch(`${baseUrl}/api/sync/account`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "phone",
        "x-focus-device-name": encodeURIComponent("iPhone Григория"),
      },
    });

    assert.equal(phoneResponse.status, 200);
    const phoneProfile = await phoneResponse.json();
    assert.equal(phoneProfile.devices.length, 2);
    assert.equal(phoneProfile.devices[0].deviceId, "phone");
    assert.equal(phoneProfile.devices[0].isCurrent, true);
    assert.equal(phoneProfile.devices[1].deviceId, "desktop");
    assert.equal(phoneProfile.devices[1].isCurrent, false);
  } finally {
    await close(server);
    db.close();
  }
});

test("sync account entitlements default paid features to disabled", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:00:00.000Z",
  });
  const baseUrl = await listen(server);
  const accountId = "account-entitlements-default";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  try {
    const response = await fetch(`${baseUrl}/api/sync/entitlements`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      accountId,
      checkedAt: "2026-07-12T09:00:00.000Z",
      entitlements: {
        voiceTranscription: {
          enabled: false,
          source: "none",
          updatedAt: null,
          activatedAt: null,
          expiresAt: null,
          paymentId: null,
        },
      },
      usage: {
        voiceTranscription: {
          accountId,
          featureKey: "voiceTranscription",
          period: "2026-07",
          used: 0,
          limit: 300,
          remaining: 300,
          resetAt: "2026-08-01T00:00:00.000Z",
          updatedAt: null,
        },
      },
    });
  } finally {
    await close(server);
    db.close();
  }
});

test("sync account entitlements expose enabled paid features", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:05:00.000Z",
  });
  const baseUrl = await listen(server);
  const accountId = "account-entitlements-enabled";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  db.setAccountEntitlements({
    accountId,
    updatedAt: "2026-07-12T09:01:00.000Z",
    entitlements: {
      voiceTranscription: {
        enabled: true,
        source: "subscription",
      },
    },
  });
  db.recordFeatureUsage({
    accountId,
    featureKey: "voiceTranscription",
    checkedAt: "2026-07-12T09:02:00.000Z",
    count: 7,
  });

  try {
    const response = await fetch(`${baseUrl}/api/sync/entitlements`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
    });

    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.accountId, accountId);
    assert.equal(result.entitlements.voiceTranscription.enabled, true);
    assert.equal(result.entitlements.voiceTranscription.source, "subscription");
    assert.equal(result.entitlements.voiceTranscription.updatedAt, "2026-07-12T09:01:00.000Z");
    assert.equal(result.entitlements.voiceTranscription.activatedAt, "2026-07-12T09:01:00.000Z");
    assert.equal(result.entitlements.voiceTranscription.expiresAt, null);
    assert.deepEqual(result.usage.voiceTranscription, {
      accountId,
      featureKey: "voiceTranscription",
      period: "2026-07",
      used: 7,
      limit: 300,
      remaining: 293,
      resetAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-07-12T09:02:00.000Z",
    });
  } finally {
    await close(server);
    db.close();
  }
});

test("sync account entitlements report expired paid features as inactive", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:05:00.000Z",
  });
  const baseUrl = await listen(server);
  const accountId = "account-entitlements-expired";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  db.setAccountEntitlements({
    accountId,
    updatedAt: "2026-06-01T09:00:00.000Z",
    entitlements: {
      voiceTranscription: {
        enabled: true,
        source: "yookassa",
        updatedAt: "2026-06-01T09:00:00.000Z",
        activatedAt: "2026-06-01T09:00:00.000Z",
        expiresAt: "2026-07-01T09:00:00.000Z",
        paymentId: "payment-expired-123",
      },
    },
  });

  try {
    const response = await fetch(`${baseUrl}/api/sync/entitlements`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
    });

    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual(result.entitlements.voiceTranscription, {
      enabled: false,
      source: "expired",
      updatedAt: "2026-06-01T09:00:00.000Z",
      activatedAt: "2026-06-01T09:00:00.000Z",
      expiresAt: "2026-07-01T09:00:00.000Z",
      paymentId: "payment-expired-123",
    });
  } finally {
    await close(server);
    db.close();
  }
});

test("sync transcription endpoint requires active voice entitlement", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:05:00.000Z",
  });
  const baseUrl = await listen(server);
  const accountId = "account-transcription-locked";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  try {
    const response = await fetch(`${baseUrl}/api/sync/transcription`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify(createTranscriptionRequest()),
    });

    assert.equal(response.status, 402);
    assert.deepEqual(await response.json(), {
      error: "feature_locked",
      status: "locked",
      accountId,
      featureKey: "voiceTranscription",
      checkedAt: "2026-07-12T09:05:00.000Z",
    });
  } finally {
    await close(server);
    db.close();
  }
});

test("sync transcription endpoint validates entitled requests before provider work", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:05:00.000Z",
  });
  const baseUrl = await listen(server);
  const accountId = "account-transcription-provider";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  db.setAccountEntitlements({
    accountId,
    updatedAt: "2026-07-12T09:00:00.000Z",
    entitlements: {
      voiceTranscription: {
        enabled: true,
        source: "subscription",
      },
    },
  });

  try {
    const invalidResponse = await fetch(`${baseUrl}/api/sync/transcription`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify({ audioBase64: "bad", mimeType: "text/plain" }),
    });

    assert.equal(invalidResponse.status, 400);
    assert.equal((await invalidResponse.json()).error, "invalid_transcription_request");

    const overlongDurationResponse = await fetch(`${baseUrl}/api/sync/transcription`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify(createTranscriptionRequest({
        durationMs: 120000,
      })),
    });

    assert.equal(overlongDurationResponse.status, 400);
    assert.equal((await overlongDurationResponse.json()).error, "invalid_transcription_request");

    const response = await fetch(`${baseUrl}/api/sync/transcription`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify(createTranscriptionRequest({
        audioBase64: "data:audio/webm;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEA",
        mimeType: "audio/webm;codecs=opus",
        language: "bad language",
      })),
    });

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "provider_not_configured",
      status: "provider_not_configured",
      accountId,
      featureKey: "voiceTranscription",
      provider: null,
      usage: {
        accountId,
        featureKey: "voiceTranscription",
        period: "2026-07",
        used: 0,
        limit: 300,
        remaining: 300,
        resetAt: "2026-08-01T00:00:00.000Z",
        updatedAt: null,
      },
      checkedAt: "2026-07-12T09:05:00.000Z",
    });
  } finally {
    await close(server);
    db.close();
  }
});

test("sync transcription endpoint enforces monthly usage quota before provider work", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:05:00.000Z",
    voiceTranscriptionMonthlyLimit: 1,
  });
  const baseUrl = await listen(server);
  const accountId = "account-transcription-quota";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  db.setAccountEntitlements({
    accountId,
    updatedAt: "2026-07-12T09:00:00.000Z",
    entitlements: {
      voiceTranscription: {
        enabled: true,
        source: "subscription",
      },
    },
  });
  db.recordFeatureUsage({
    accountId,
    featureKey: "voiceTranscription",
    checkedAt: "2026-07-12T09:00:00.000Z",
    count: 1,
    limit: 1,
  });

  try {
    const response = await fetch(`${baseUrl}/api/sync/transcription`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify(createTranscriptionRequest()),
    });

    assert.equal(response.status, 429);
    assert.deepEqual(await response.json(), {
      error: "usage_limit_exceeded",
      status: "usage_limit_exceeded",
      accountId,
      featureKey: "voiceTranscription",
      usage: {
        accountId,
        featureKey: "voiceTranscription",
        period: "2026-07",
        used: 1,
        limit: 1,
        remaining: 0,
        resetAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-07-12T09:00:00.000Z",
      },
      checkedAt: "2026-07-12T09:05:00.000Z",
    });
    assert.deepEqual(db.getFeatureUsage({
      accountId,
      featureKey: "voiceTranscription",
      checkedAt: "2026-08-01T00:00:00.000Z",
      limit: 1,
    }), {
      accountId,
      featureKey: "voiceTranscription",
      period: "2026-08",
      used: 0,
      limit: 1,
      remaining: 1,
      resetAt: "2026-09-01T00:00:00.000Z",
      updatedAt: null,
    });
  } finally {
    await close(server);
    db.close();
  }
});

test("sync transcription provider scaffold does not spend monthly usage", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:05:00.000Z",
    voiceTranscriptionMonthlyLimit: 1,
  });
  const baseUrl = await listen(server);
  const accountId = "account-transcription-no-spend";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  db.setAccountEntitlements({
    accountId,
    updatedAt: "2026-07-12T09:00:00.000Z",
    entitlements: {
      voiceTranscription: {
        enabled: true,
        source: "subscription",
      },
    },
  });

  try {
    const response = await fetch(`${baseUrl}/api/sync/transcription`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify(createTranscriptionRequest()),
    });

    assert.equal(response.status, 503);
    assert.deepEqual(db.getFeatureUsage({
      accountId,
      featureKey: "voiceTranscription",
      checkedAt: "2026-07-12T09:06:00.000Z",
      limit: 1,
    }), {
      accountId,
      featureKey: "voiceTranscription",
      period: "2026-07",
      used: 0,
      limit: 1,
      remaining: 1,
      resetAt: "2026-08-01T00:00:00.000Z",
      updatedAt: null,
    });
  } finally {
    await close(server);
    db.close();
  }
});

test("sync transcription endpoint uses configured local provider and spends monthly usage", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:05:00.000Z",
    voiceTranscriptionMonthlyLimit: 2,
    voiceTranscriptionProvider: {
      provider: "localEcho",
      text: "Новая задача: подготовить план",
    },
  });
  const baseUrl = await listen(server);
  const accountId = "account-transcription-local-provider";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  db.setAccountEntitlements({
    accountId,
    updatedAt: "2026-07-12T09:00:00.000Z",
    entitlements: {
      voiceTranscription: {
        enabled: true,
        source: "subscription",
      },
    },
  });

  try {
    const response = await fetch(`${baseUrl}/api/sync/transcription`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify(createTranscriptionRequest({
        language: "ru-RU",
        prompt: "задача",
      })),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "transcribed",
      provider: "localEcho",
      text: "Новая задача: подготовить план",
      language: "ru-RU",
      checkedAt: "2026-07-12T09:05:00.000Z",
      accountId,
      featureKey: "voiceTranscription",
      usage: {
        accountId,
        featureKey: "voiceTranscription",
        period: "2026-07",
        used: 1,
        limit: 2,
        remaining: 1,
        resetAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-07-12T09:05:00.000Z",
      },
    });
  } finally {
    await close(server);
    db.close();
  }
});

test("sync transcription endpoint can use configured OpenAI provider", async () => {
  const db = createSyncDatabase(":memory:");
  const providerCalls = [];
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:05:00.000Z",
    voiceTranscriptionMonthlyLimit: 2,
    voiceTranscriptionProvider: {
      provider: "openai",
      apiKey: "sk-test-openai-transcription-key",
      model: "gpt-transcribe",
      transcriptionsUrl: "https://api.openai.test/v1/audio/transcriptions",
      organization: "org_focus",
      project: "proj_focus",
    },
    fetchImpl: async (url, options = {}) => {
      providerCalls.push({ url, options });
      return jsonResponse(200, { text: "Новая задача из записи" });
    },
  });
  const baseUrl = await listen(server);
  const accountId = "account-transcription-openai-provider";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  db.setAccountEntitlements({
    accountId,
    updatedAt: "2026-07-12T09:00:00.000Z",
    entitlements: {
      voiceTranscription: {
        enabled: true,
        source: "subscription",
      },
    },
  });

  try {
    const response = await fetch(`${baseUrl}/api/sync/transcription`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify(createTranscriptionRequest({
        language: "ru-RU",
        prompt: "задача",
      })),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "transcribed",
      provider: "openai",
      text: "Новая задача из записи",
      language: "ru-RU",
      checkedAt: "2026-07-12T09:05:00.000Z",
      accountId,
      featureKey: "voiceTranscription",
      usage: {
        accountId,
        featureKey: "voiceTranscription",
        period: "2026-07",
        used: 1,
        limit: 2,
        remaining: 1,
        resetAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-07-12T09:05:00.000Z",
      },
    });

    assert.equal(providerCalls.length, 1);
    assert.equal(providerCalls[0].url, "https://api.openai.test/v1/audio/transcriptions");
    assert.equal(providerCalls[0].options.method, "POST");
    assert.equal(providerCalls[0].options.headers.authorization, "Bearer sk-test-openai-transcription-key");
    assert.equal(providerCalls[0].options.headers["openai-organization"], "org_focus");
    assert.equal(providerCalls[0].options.headers["openai-project"], "proj_focus");

    const formData = providerCalls[0].options.body;
    assert.equal(formData.get("model"), "gpt-transcribe");
    assert.equal(formData.get("response_format"), "json");
    assert.equal(formData.get("language"), "ru");
    assert.equal(formData.get("prompt"), "задача");
    const audioFile = formData.get("file");
    assert.equal(audioFile.name, "focus-audio.webm");
    assert.equal(audioFile.type, "audio/webm");
    assert.ok(audioFile.size > 0);
  } finally {
    await close(server);
    db.close();
  }
});

test("sync transcription OpenAI provider failures do not spend monthly usage", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:05:00.000Z",
    voiceTranscriptionMonthlyLimit: 1,
    voiceTranscriptionProvider: {
      provider: "openai",
      apiKey: "sk-test-openai-transcription-key",
      model: "gpt-transcribe",
      transcriptionsUrl: "https://api.openai.test/v1/audio/transcriptions",
    },
    fetchImpl: async () => jsonResponse(401, {
      error: {
        type: "invalid_api_key",
      },
    }),
  });
  const baseUrl = await listen(server);
  const accountId = "account-transcription-openai-failed";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  db.setAccountEntitlements({
    accountId,
    updatedAt: "2026-07-12T09:00:00.000Z",
    entitlements: {
      voiceTranscription: {
        enabled: true,
        source: "subscription",
      },
    },
  });

  try {
    const response = await fetch(`${baseUrl}/api/sync/transcription`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify(createTranscriptionRequest()),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      error: "provider_failed",
      status: "failed",
      provider: "openai",
      reason: "provider_auth_failed",
      text: "",
      checkedAt: "2026-07-12T09:05:00.000Z",
      accountId,
      featureKey: "voiceTranscription",
      usage: {
        accountId,
        featureKey: "voiceTranscription",
        period: "2026-07",
        used: 0,
        limit: 1,
        remaining: 1,
        resetAt: "2026-08-01T00:00:00.000Z",
        updatedAt: null,
      },
    });
    assert.equal(db.getFeatureUsage({
      accountId,
      featureKey: "voiceTranscription",
      checkedAt: "2026-07-12T09:06:00.000Z",
      limit: 1,
    }).used, 0);
  } finally {
    await close(server);
    db.close();
  }
});

test("sync transcription OpenAI provider timeout does not spend monthly usage", async () => {
  const db = createSyncDatabase(":memory:");
  const providerCalls = [];
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:05:00.000Z",
    voiceTranscriptionMonthlyLimit: 1,
    voiceTranscriptionProvider: {
      provider: "openai",
      apiKey: "sk-test-openai-transcription-key",
      model: "gpt-transcribe",
      transcriptionsUrl: "https://api.openai.test/v1/audio/transcriptions",
      timeoutMs: 1,
    },
    fetchImpl: async (url, options = {}) => {
      providerCalls.push({ url, options });
      assert.ok(options.signal);
      return new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      });
    },
  });
  const baseUrl = await listen(server);
  const accountId = "account-transcription-openai-timeout";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  db.setAccountEntitlements({
    accountId,
    updatedAt: "2026-07-12T09:00:00.000Z",
    entitlements: {
      voiceTranscription: {
        enabled: true,
        source: "subscription",
      },
    },
  });

  try {
    const response = await fetch(`${baseUrl}/api/sync/transcription`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify(createTranscriptionRequest()),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      error: "provider_failed",
      status: "failed",
      provider: "openai",
      reason: "provider_timeout",
      text: "",
      checkedAt: "2026-07-12T09:05:00.000Z",
      accountId,
      featureKey: "voiceTranscription",
      usage: {
        accountId,
        featureKey: "voiceTranscription",
        period: "2026-07",
        used: 0,
        limit: 1,
        remaining: 1,
        resetAt: "2026-08-01T00:00:00.000Z",
        updatedAt: null,
      },
    });
    assert.equal(providerCalls.length, 1);
    assert.equal(providerCalls[0].options.signal.aborted, true);
    assert.equal(db.getFeatureUsage({
      accountId,
      featureKey: "voiceTranscription",
      checkedAt: "2026-07-12T09:06:00.000Z",
      limit: 1,
    }).used, 0);
  } finally {
    await close(server);
    db.close();
  }
});

test("sync transcription endpoint reports provider failure without spending monthly usage", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:05:00.000Z",
    voiceTranscriptionMonthlyLimit: 1,
    voiceTranscriptionProvider: {
      provider: "failingProvider",
      transcribe: async () => ({ text: "" }),
    },
  });
  const baseUrl = await listen(server);
  const accountId = "account-transcription-provider-failed";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  db.setAccountEntitlements({
    accountId,
    updatedAt: "2026-07-12T09:00:00.000Z",
    entitlements: {
      voiceTranscription: {
        enabled: true,
        source: "subscription",
      },
    },
  });

  try {
    const response = await fetch(`${baseUrl}/api/sync/transcription`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify(createTranscriptionRequest()),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      error: "provider_failed",
      status: "failed",
      provider: "failingProvider",
      reason: "empty_transcription",
      text: "",
      checkedAt: "2026-07-12T09:05:00.000Z",
      accountId,
      featureKey: "voiceTranscription",
      usage: {
        accountId,
        featureKey: "voiceTranscription",
        period: "2026-07",
        used: 0,
        limit: 1,
        remaining: 1,
        resetAt: "2026-08-01T00:00:00.000Z",
        updatedAt: null,
      },
    });
    assert.equal(db.getFeatureUsage({
      accountId,
      featureKey: "voiceTranscription",
      checkedAt: "2026-07-12T09:06:00.000Z",
      limit: 1,
    }).used, 0);
  } finally {
    await close(server);
    db.close();
  }
});

test("sync transcription status endpoint reports provider readiness and limits", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:05:00.000Z",
    voiceTranscriptionMonthlyLimit: 12,
    voiceTranscriptionProvider: {
      provider: "localEcho",
      text: "Новая задача",
    },
  });
  const baseUrl = await listen(server);
  const accountId = "account-transcription-status";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  try {
    const response = await fetch(`${baseUrl}/api/sync/transcription/status`, {
      method: "GET",
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      accountId,
      featureKey: "voiceTranscription",
      providerConfigured: true,
      provider: "localEcho",
      providerModel: null,
      providerTimeoutMs: null,
      monthlyLimit: 12,
      maxDurationMs: 60000,
      checkedAt: "2026-07-12T09:05:00.000Z",
    });

    const methodResponse = await fetch(`${baseUrl}/api/sync/transcription/status`, {
      method: "POST",
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
    });

    assert.equal(methodResponse.status, 405);
    assert.equal((await methodResponse.json()).error, "method_not_allowed");
  } finally {
    await close(server);
    db.close();
  }
});

test("sync transcription status endpoint reports configured OpenAI model", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:05:00.000Z",
    voiceTranscriptionProvider: {
      provider: "openai",
      apiKey: "sk-test-openai-transcription-key",
      model: "gpt-transcribe",
      transcriptionsUrl: "https://api.openai.test/v1/audio/transcriptions",
      timeoutMs: 45000,
    },
  });
  const baseUrl = await listen(server);
  const accountId = "account-transcription-openai-status";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  try {
    const response = await fetch(`${baseUrl}/api/sync/transcription/status`, {
      method: "GET",
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
    });

    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.accountId, accountId);
    assert.equal(result.providerConfigured, true);
    assert.equal(result.provider, "openai");
    assert.equal(result.providerModel, "gpt-transcribe");
    assert.equal(result.providerTimeoutMs, 45000);
  } finally {
    await close(server);
    db.close();
  }
});

test("sync transcription events endpoint lists diagnostics without audio or text payloads", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:05:00.000Z",
    voiceTranscriptionMonthlyLimit: 2,
    voiceTranscriptionProvider: {
      provider: "localEcho",
      text: "Новая задача",
    },
  });
  const baseUrl = await listen(server);
  const accountId = "account-transcription-events";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  db.setAccountEntitlements({
    accountId,
    updatedAt: "2026-07-12T09:00:00.000Z",
    entitlements: {
      voiceTranscription: {
        enabled: true,
        source: "subscription",
      },
    },
  });

  try {
    const invalidResponse = await fetch(`${baseUrl}/api/sync/transcription`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify({ audioBase64: "bad", mimeType: "text/plain" }),
    });
    assert.equal(invalidResponse.status, 400);

    const successResponse = await fetch(`${baseUrl}/api/sync/transcription`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify(createTranscriptionRequest({
        audioBase64: "data:audio/webm;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEA",
        mimeType: "audio/webm;codecs=opus",
        durationMs: 12345.9,
        language: "ru-RU",
      })),
    });
    assert.equal(successResponse.status, 200);

    const eventsResponse = await fetch(`${baseUrl}/api/sync/transcription/events`, {
      method: "GET",
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
    });
    assert.equal(eventsResponse.status, 200);
    const result = await eventsResponse.json();
    assert.equal(result.accountId, accountId);
    assert.equal(result.events.length, 2);

    const [successEvent, invalidEvent] = result.events;
    assert.equal(typeof successEvent.id, "string");
    assert.equal(successEvent.accountId, accountId);
    assert.equal(successEvent.deviceId, "desktop");
    assert.equal(successEvent.status, "transcribed");
    assert.equal(successEvent.provider, "localEcho");
    assert.equal(successEvent.reason, null);
    assert.equal(successEvent.mimeType, "audio/webm");
    assert.equal(successEvent.durationMs, 12345);
    assert.equal(successEvent.language, "ru-RU");
    assert.equal(successEvent.textLength, "Новая задача".length);
    assert.equal(successEvent.spent, true);
    assert.deepEqual(successEvent.usage, {
      period: "2026-07",
      used: 1,
      limit: 2,
      remaining: 1,
      resetAt: "2026-08-01T00:00:00.000Z",
    });
    assert.equal(Object.hasOwn(successEvent, "audioBase64"), false);
    assert.equal(Object.hasOwn(successEvent, "audio"), false);
    assert.equal(Object.hasOwn(successEvent, "text"), false);

    assert.equal(typeof invalidEvent.id, "string");
    assert.equal(invalidEvent.status, "invalid");
    assert.equal(invalidEvent.provider, null);
    assert.equal(invalidEvent.reason, "invalid_transcription_request");
    assert.equal(invalidEvent.mimeType, null);
    assert.equal(invalidEvent.durationMs, 0);
    assert.equal(invalidEvent.textLength, 0);
    assert.equal(invalidEvent.spent, false);
    assert.equal(invalidEvent.usage, null);
    assert.equal(Object.hasOwn(invalidEvent, "audioBase64"), false);
    assert.equal(Object.hasOwn(invalidEvent, "audio"), false);
    assert.equal(Object.hasOwn(invalidEvent, "text"), false);
  } finally {
    await close(server);
    db.close();
  }
});

test("sync entitlement events endpoint lists access audit entries", async () => {
  const db = createSyncDatabase(":memory:");
  const ticks = [
    "2026-07-12T09:00:00.000Z",
    "2026-07-12T09:01:00.000Z",
    "2026-07-12T09:02:00.000Z",
  ];
  const server = createFocusSyncServer({
    db,
    now: () => ticks.shift() || "2026-07-12T09:02:00.000Z",
    adminToken: "focus-admin-token-123",
    yookassaWebhookToken: "focus-yookassa-token-123",
  });
  const baseUrl = await listen(server);
  const accountId = "account-entitlement-events";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  try {
    const adminResponse = await fetch(`${baseUrl}/api/admin/entitlements`, {
      method: "POST",
      headers: {
        authorization: "Bearer focus-admin-token-123",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        accountId,
        featureKey: "voiceTranscription",
        source: "manual.test",
      }),
    });
    assert.equal(adminResponse.status, 200);

    const webhookResponse = await fetch(`${baseUrl}/api/yookassa/webhook?token=focus-yookassa-token-123`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(createYooKassaPaymentNotification({
        accountId,
        paymentId: "payment-entitlement-events-123",
      })),
    });
    assert.equal(webhookResponse.status, 200);

    const eventsResponse = await fetch(`${baseUrl}/api/sync/entitlements/events`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
    });

    assert.equal(eventsResponse.status, 200);
    const result = await eventsResponse.json();
    assert.equal(result.accountId, accountId);
    assert.equal(result.events.length, 2);
    assert.match(result.events[0].id, /^[a-f0-9-]{36}$/);
    assert.deepEqual({
      accountId: result.events[0].accountId,
      featureKey: result.events[0].featureKey,
      origin: result.events[0].origin,
      status: result.events[0].status,
      source: result.events[0].source,
      paymentId: result.events[0].paymentId,
      paymentStatus: result.events[0].paymentStatus,
      paid: result.events[0].paid,
      reason: result.events[0].reason,
      expiresAt: result.events[0].expiresAt,
      createdAt: result.events[0].createdAt,
    }, {
      accountId,
      featureKey: "voiceTranscription",
      origin: "yookassa-webhook",
      status: "activated",
      source: "yookassa",
      paymentId: "payment-entitlement-events-123",
      paymentStatus: "succeeded",
      paid: true,
      reason: null,
      expiresAt: "2026-08-11T09:01:00.000Z",
      createdAt: "2026-07-12T09:01:00.000Z",
    });
    assert.deepEqual({
      featureKey: result.events[1].featureKey,
      origin: result.events[1].origin,
      status: result.events[1].status,
      source: result.events[1].source,
      paymentId: result.events[1].paymentId,
      paymentStatus: result.events[1].paymentStatus,
      paid: result.events[1].paid,
      reason: result.events[1].reason,
      expiresAt: result.events[1].expiresAt,
      createdAt: result.events[1].createdAt,
    }, {
      featureKey: "voiceTranscription",
      origin: "admin",
      status: "activated",
      source: "manual.test",
      paymentId: null,
      paymentStatus: null,
      paid: false,
      reason: null,
      expiresAt: null,
      createdAt: "2026-07-12T09:00:00.000Z",
    });
  } finally {
    await close(server);
    db.close();
  }
});

test("admin entitlement endpoint is disabled without a configured token", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({ db, adminToken: "" });
  const baseUrl = await listen(server);
  const accountId = "account-admin-entitlements-disabled";
  createTestAccount(db, accountId);

  try {
    const response = await fetch(`${baseUrl}/api/admin/entitlements`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-admin-token": "configured-token-123",
      },
      body: JSON.stringify({ accountId, featureKey: "voiceTranscription" }),
    });

    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, "not_found");
    assert.equal(db.getAccountEntitlements(accountId).voiceTranscription.enabled, false);
  } finally {
    await close(server);
    db.close();
  }
});

test("admin entitlement endpoint requires the configured token", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    adminToken: "focus-admin-token-123",
  });
  const baseUrl = await listen(server);
  const accountId = "account-admin-entitlements-auth";
  createTestAccount(db, accountId);

  try {
    const missingTokenResponse = await fetch(`${baseUrl}/api/admin/entitlements`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountId, featureKey: "voiceTranscription" }),
    });
    assert.equal(missingTokenResponse.status, 401);
    assert.equal((await missingTokenResponse.json()).error, "admin_token_required");

    const wrongTokenResponse = await fetch(`${baseUrl}/api/admin/entitlements`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-admin-token": "wrong-admin-token-123",
      },
      body: JSON.stringify({ accountId, featureKey: "voiceTranscription" }),
    });
    assert.equal(wrongTokenResponse.status, 401);
    assert.equal((await wrongTokenResponse.json()).error, "admin_token_required");
    assert.equal(db.getAccountEntitlements(accountId).voiceTranscription.enabled, false);
  } finally {
    await close(server);
    db.close();
  }
});

test("admin entitlement endpoint can activate and disable paid feature access", async () => {
  const db = createSyncDatabase(":memory:");
  const ticks = [
    "2026-07-12T09:06:00.000Z",
    "2026-07-12T09:07:00.000Z",
    "2026-07-12T09:08:00.000Z",
  ];
  let tickIndex = 0;
  const server = createFocusSyncServer({
    db,
    adminToken: "focus-admin-token-123",
    now: () => ticks[Math.min(tickIndex++, ticks.length - 1)],
  });
  const baseUrl = await listen(server);
  const accountId = "account-admin-entitlements-active";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  try {
    const activateResponse = await fetch(`${baseUrl}/api/admin/entitlements`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-admin-token": "focus-admin-token-123",
      },
      body: JSON.stringify({
        accountId,
        featureKey: "voice_transcription",
        enabled: true,
        source: "manual.test",
      }),
    });

    assert.equal(activateResponse.status, 200);
    assert.deepEqual(await activateResponse.json(), {
      accountId,
      featureKey: "voiceTranscription",
      checkedAt: "2026-07-12T09:06:00.000Z",
      entitlements: {
        voiceTranscription: {
          enabled: true,
          source: "manual.test",
          updatedAt: "2026-07-12T09:06:00.000Z",
          activatedAt: "2026-07-12T09:06:00.000Z",
          expiresAt: null,
          paymentId: null,
        },
      },
    });

    const entitlementResponse = await fetch(`${baseUrl}/api/sync/entitlements`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
    });
    assert.equal(entitlementResponse.status, 200);
    const entitlementResult = await entitlementResponse.json();
    assert.equal(entitlementResult.entitlements.voiceTranscription.enabled, true);
    assert.equal(entitlementResult.entitlements.voiceTranscription.source, "manual.test");

    const disableResponse = await fetch(`${baseUrl}/api/admin/entitlements`, {
      method: "POST",
      headers: {
        authorization: "Bearer focus-admin-token-123",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        account: accountId,
        feature: "voiceTranscription",
        enabled: false,
      }),
    });

    assert.equal(disableResponse.status, 200);
    const disabledResult = await disableResponse.json();
    assert.equal(disabledResult.checkedAt, "2026-07-12T09:08:00.000Z");
    assert.deepEqual(disabledResult.entitlements.voiceTranscription, {
      enabled: false,
      source: "none",
      updatedAt: null,
      activatedAt: null,
      expiresAt: null,
      paymentId: null,
    });
  } finally {
    await close(server);
    db.close();
  }
});

test("admin entitlement endpoint rejects unknown accounts and paid features", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    adminToken: "focus-admin-token-123",
  });
  const baseUrl = await listen(server);
  const accountId = "account-admin-entitlements-invalid";
  createTestAccount(db, accountId);

  try {
    const unknownAccountResponse = await fetch(`${baseUrl}/api/admin/entitlements`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-admin-token": "focus-admin-token-123",
      },
      body: JSON.stringify({
        accountId: "missing-admin-entitlements-account",
        featureKey: "voiceTranscription",
      }),
    });
    assert.equal(unknownAccountResponse.status, 404);
    assert.equal((await unknownAccountResponse.json()).error, "account_not_found");
    assert.equal(db.getAccount("missing-admin-entitlements-account"), null);

    const unknownFeatureResponse = await fetch(`${baseUrl}/api/admin/entitlements`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-admin-token": "focus-admin-token-123",
      },
      body: JSON.stringify({
        accountId,
        featureKey: "unknownFeature",
      }),
    });
    assert.equal(unknownFeatureResponse.status, 400);
    assert.equal((await unknownFeatureResponse.json()).error, "invalid_paid_feature");
    assert.equal(db.getAccountEntitlements(accountId).voiceTranscription.enabled, false);
  } finally {
    await close(server);
    db.close();
  }
});

test("YooKassa webhook endpoint is disabled without a configured token", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({ db, yookassaWebhookToken: "" });
  const baseUrl = await listen(server);
  const accountId = "account-yookassa-webhook-disabled";
  createTestAccount(db, accountId);

  try {
    const response = await fetch(`${baseUrl}/api/yookassa/webhook?token=focus-yookassa-token-123`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(createYooKassaPaymentNotification({ accountId })),
    });

    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, "not_found");
    assert.equal(db.getAccountEntitlements(accountId).voiceTranscription.enabled, false);
  } finally {
    await close(server);
    db.close();
  }
});

test("YooKassa webhook endpoint requires the configured token", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    yookassaWebhookToken: "focus-yookassa-token-123",
  });
  const baseUrl = await listen(server);
  const accountId = "account-yookassa-webhook-auth";
  createTestAccount(db, accountId);

  try {
    const missingTokenResponse = await fetch(`${baseUrl}/api/yookassa/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(createYooKassaPaymentNotification({ accountId })),
    });
    assert.equal(missingTokenResponse.status, 401);
    assert.equal((await missingTokenResponse.json()).error, "yookassa_webhook_token_required");

    const wrongTokenResponse = await fetch(`${baseUrl}/api/yookassa/webhook?token=wrong-yookassa-token-123`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(createYooKassaPaymentNotification({ accountId })),
    });
    assert.equal(wrongTokenResponse.status, 401);
    assert.equal((await wrongTokenResponse.json()).error, "yookassa_webhook_token_required");
    assert.equal(db.getAccountEntitlements(accountId).voiceTranscription.enabled, false);
  } finally {
    await close(server);
    db.close();
  }
});

test("YooKassa payment succeeded webhook activates voice transcription access", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:20:00.000Z",
    yookassaWebhookToken: "focus-yookassa-token-123",
  });
  const baseUrl = await listen(server);
  const accountId = "account-yookassa-webhook-success";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  try {
    const response = await fetch(`${baseUrl}/api/yookassa/webhook?token=focus-yookassa-token-123`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(createYooKassaPaymentNotification({
        accountId,
        featureKey: "voice_transcription",
        paymentId: "2f295ff7-000f-5000-9000-1baf6b9e6d2b",
      })),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "activated",
      accountId,
      featureKey: "voiceTranscription",
      paymentId: "2f295ff7-000f-5000-9000-1baf6b9e6d2b",
      checkedAt: "2026-07-12T09:20:00.000Z",
      entitlements: {
        voiceTranscription: {
          enabled: true,
          source: "yookassa",
          updatedAt: "2026-07-12T09:20:00.000Z",
          activatedAt: "2026-07-12T09:20:00.000Z",
          expiresAt: "2026-08-11T09:20:00.000Z",
          paymentId: "2f295ff7-000f-5000-9000-1baf6b9e6d2b",
        },
      },
    });
    assert.deepEqual(db.getAccountEntitlements(accountId).voiceTranscription, {
      enabled: true,
      source: "yookassa",
      updatedAt: "2026-07-12T09:20:00.000Z",
      activatedAt: "2026-07-12T09:20:00.000Z",
      expiresAt: "2026-08-11T09:20:00.000Z",
      paymentId: "2f295ff7-000f-5000-9000-1baf6b9e6d2b",
    });
  } finally {
    await close(server);
    db.close();
  }
});

test("YooKassa duplicate payment webhook keeps the existing subscription period", async () => {
  const db = createSyncDatabase(":memory:");
  const ticks = [
    "2026-07-12T09:20:00.000Z",
    "2026-07-12T09:25:00.000Z",
  ];
  const server = createFocusSyncServer({
    db,
    now: () => ticks.shift() || "2026-07-12T09:25:00.000Z",
    yookassaWebhookToken: "focus-yookassa-token-123",
  });
  const baseUrl = await listen(server);
  const accountId = "account-yookassa-webhook-duplicate";
  const paymentId = "payment-duplicate-123";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  try {
    const request = () => fetch(`${baseUrl}/api/yookassa/webhook?token=focus-yookassa-token-123`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(createYooKassaPaymentNotification({ accountId, paymentId })),
    });

    const firstResponse = await request();
    assert.equal(firstResponse.status, 200);
    assert.equal((await firstResponse.json()).entitlements.voiceTranscription.expiresAt, "2026-08-11T09:20:00.000Z");

    const secondResponse = await request();
    assert.equal(secondResponse.status, 200);
    const secondResult = await secondResponse.json();
    assert.equal(secondResult.status, "ignored");
    assert.equal(secondResult.reason, "webhook_event_already_processed");
    assert.equal(secondResult.provider, "yookassa");
    assert.equal(secondResult.event, "payment.succeeded");
    assert.equal(secondResult.paymentId, paymentId);
    assert.equal(secondResult.checkedAt, "2026-07-12T09:25:00.000Z");
    assert.equal(secondResult.firstProcessedAt, "2026-07-12T09:20:00.000Z");
    assert.deepEqual(db.getAccountEntitlements(accountId).voiceTranscription, {
      enabled: true,
      source: "yookassa",
      updatedAt: "2026-07-12T09:20:00.000Z",
      activatedAt: "2026-07-12T09:20:00.000Z",
      expiresAt: "2026-08-11T09:20:00.000Z",
      paymentId,
    });
    assert.equal(db.listEntitlementEvents(accountId).length, 1);
  } finally {
    await close(server);
    db.close();
  }
});

test("YooKassa duplicate payment webhook does not reactivate an expired period", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    now: () => "2026-08-12T09:20:00.000Z",
    yookassaWebhookToken: "focus-yookassa-token-123",
  });
  const baseUrl = await listen(server);
  const accountId = "account-yookassa-webhook-expired-duplicate";
  const paymentId = "payment-expired-duplicate-123";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");
  db.setAccountEntitlements({
    accountId,
    updatedAt: "2026-07-12T09:20:00.000Z",
    entitlements: {
      voiceTranscription: {
        enabled: true,
        source: "yookassa",
        updatedAt: "2026-07-12T09:20:00.000Z",
        activatedAt: "2026-07-12T09:20:00.000Z",
        expiresAt: "2026-08-11T09:20:00.000Z",
        paymentId,
      },
    },
  });

  try {
    const response = await fetch(`${baseUrl}/api/yookassa/webhook?token=focus-yookassa-token-123`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(createYooKassaPaymentNotification({ accountId, paymentId })),
    });

    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.status, "ignored");
    assert.equal(result.reason, "payment_already_applied");
    assert.deepEqual(result.entitlements.voiceTranscription, {
      enabled: false,
      source: "expired",
      updatedAt: "2026-07-12T09:20:00.000Z",
      activatedAt: "2026-07-12T09:20:00.000Z",
      expiresAt: "2026-08-11T09:20:00.000Z",
      paymentId,
    });
  } finally {
    await close(server);
    db.close();
  }
});

test("YooKassa webhook ignores non-activating or unmatched notifications", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    yookassaWebhookToken: "focus-yookassa-token-123",
  });
  const baseUrl = await listen(server);
  const accountId = "account-yookassa-webhook-ignored";
  createTestAccount(db, accountId);

  try {
    const canceledResponse = await fetch(`${baseUrl}/api/yookassa/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-yookassa-token": "focus-yookassa-token-123",
      },
      body: JSON.stringify(createYooKassaPaymentNotification({
        accountId,
        event: "payment.canceled",
        status: "canceled",
        paid: false,
      })),
    });
    assert.equal(canceledResponse.status, 200);
    assert.equal((await canceledResponse.json()).status, "ignored");

    const missingMetadataResponse = await fetch(`${baseUrl}/api/yookassa/webhook?token=focus-yookassa-token-123`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(createYooKassaPaymentNotification({
        accountId: "",
      })),
    });
    assert.equal(missingMetadataResponse.status, 200);
    assert.equal((await missingMetadataResponse.json()).reason, "account_missing");

    const unknownAccountResponse = await fetch(`${baseUrl}/api/yookassa/webhook?token=focus-yookassa-token-123`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(createYooKassaPaymentNotification({
        accountId: "missing-yookassa-webhook-account",
      })),
    });
    assert.equal(unknownAccountResponse.status, 200);
    assert.equal((await unknownAccountResponse.json()).reason, "account_not_found");
    assert.equal(db.getAccount("missing-yookassa-webhook-account"), null);
    assert.equal(db.getAccountEntitlements(accountId).voiceTranscription.enabled, false);
  } finally {
    await close(server);
    db.close();
  }
});

test("subscription checkout reports missing payment provider without activating access", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:10:00.000Z",
    subscriptionCheckoutUrl: "",
    yookassaConfig: null,
  });
  const baseUrl = await listen(server);
  const accountId = "account-checkout-missing-provider";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  try {
    const response = await fetch(`${baseUrl}/api/sync/checkout`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify({ featureKey: "voiceTranscription" }),
    });

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "provider_not_configured",
      status: "provider_not_configured",
      accountId,
      featureKey: "voiceTranscription",
      checkoutUrl: null,
      checkedAt: "2026-07-12T09:10:00.000Z",
    });
    assert.equal(db.getAccountEntitlements(accountId).voiceTranscription.enabled, false);
  } finally {
    await close(server);
    db.close();
  }
});

test("subscription checkout returns configured provider URL for paid features", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:11:00.000Z",
    subscriptionCheckoutUrl: "https://pay.example/checkout?plan=focus-plus",
    yookassaConfig: null,
  });
  const baseUrl = await listen(server);
  const accountId = "account-checkout-ready";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  try {
    const response = await fetch(`${baseUrl}/api/sync/checkout`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify({ featureKey: "voice_transcription" }),
    });

    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.status, "ready");
    assert.equal(result.accountId, accountId);
    assert.equal(result.featureKey, "voiceTranscription");
    assert.equal(result.checkedAt, "2026-07-12T09:11:00.000Z");

    const checkoutUrl = new URL(result.checkoutUrl);
    assert.equal(checkoutUrl.origin, "https://pay.example");
    assert.equal(checkoutUrl.pathname, "/checkout");
    assert.equal(checkoutUrl.searchParams.get("plan"), "focus-plus");
    assert.equal(checkoutUrl.searchParams.get("account"), accountId);
    assert.equal(checkoutUrl.searchParams.get("feature"), "voiceTranscription");
    assert.equal(db.getAccountEntitlements(accountId).voiceTranscription.enabled, false);
  } finally {
    await close(server);
    db.close();
  }
});

test("subscription checkout creates a YooKassa redirect payment when configured", async () => {
  const db = createSyncDatabase(":memory:");
  const providerCalls = [];
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:12:00.000Z",
    createId: () => "checkout-idempotence-key-1",
    subscriptionCheckoutUrl: "https://pay.example/fallback",
    yookassaConfig: {
      shopId: "123456",
      secretKey: "test_secret_key",
      returnUrl: "https://focus-v2.dmnao83.ru/subscription.html",
      paymentsUrl: "https://api.yookassa.test/v3/payments",
      amountValue: "199.00",
      currency: "RUB",
    },
    fetchImpl: async (url, options) => {
      providerCalls.push({ url, options });
      return jsonResponse(200, {
        id: "2f295ff7-000f-5000-9000-1baf6b9e6d2b",
        status: "pending",
        confirmation: {
          type: "redirect",
          confirmation_url: "https://yookassa.test/checkout/payments/v2/contract",
        },
      });
    },
  });
  const baseUrl = await listen(server);
  const accountId = "account-checkout-yookassa";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  try {
    const response = await fetch(`${baseUrl}/api/sync/checkout`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify({ featureKey: "voiceTranscription" }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ready",
      accountId,
      featureKey: "voiceTranscription",
      checkoutUrl: "https://yookassa.test/checkout/payments/v2/contract",
      checkedAt: "2026-07-12T09:12:00.000Z",
      provider: "yookassa",
      paymentId: "2f295ff7-000f-5000-9000-1baf6b9e6d2b",
    });
    assert.equal(providerCalls.length, 1);
    assert.equal(providerCalls[0].url, "https://api.yookassa.test/v3/payments");
    assert.equal(providerCalls[0].options.method, "POST");
    assert.equal(providerCalls[0].options.headers["idempotence-key"], "checkout-idempotence-key-1");
    assert.equal(providerCalls[0].options.headers.authorization, `Basic ${Buffer.from("123456:test_secret_key").toString("base64")}`);
    assert.deepEqual(JSON.parse(providerCalls[0].options.body), {
      amount: {
        value: "199.00",
        currency: "RUB",
      },
      capture: true,
      confirmation: {
        type: "redirect",
        return_url: "https://focus-v2.dmnao83.ru/subscription.html",
      },
      description: "Focus Plus: голосовой ввод",
      metadata: {
        accountId,
        featureKey: "voiceTranscription",
        focusAccountId: accountId,
        focusFeatureKey: "voiceTranscription",
      },
    });
    assert.equal(db.getAccountEntitlements(accountId).voiceTranscription.enabled, false);
  } finally {
    await close(server);
    db.close();
  }
});

test("subscription checkout reports YooKassa provider failures without activating access", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:13:00.000Z",
    createId: () => "checkout-idempotence-key-2",
    yookassaConfig: {
      shopId: "123456",
      secretKey: "test_secret_key",
      returnUrl: "https://focus-v2.dmnao83.ru/subscription.html",
      paymentsUrl: "https://api.yookassa.test/v3/payments",
      amountValue: "199.00",
      currency: "RUB",
    },
    fetchImpl: async () => jsonResponse(401, {
      type: "error",
      code: "invalid_credentials",
    }),
  });
  const baseUrl = await listen(server);
  const accountId = "account-checkout-yookassa-failed";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  try {
    const response = await fetch(`${baseUrl}/api/sync/checkout`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify({ featureKey: "voiceTranscription" }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "failed",
      accountId,
      featureKey: "voiceTranscription",
      checkoutUrl: null,
      checkedAt: "2026-07-12T09:13:00.000Z",
      provider: "yookassa",
      error: "invalid_credentials",
    });
    assert.equal(db.getAccountEntitlements(accountId).voiceTranscription.enabled, false);
  } finally {
    await close(server);
    db.close();
  }
});

test("subscription checkout reports YooKassa network failures without server errors", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:14:00.000Z",
    createId: () => "checkout-idempotence-key-3",
    yookassaConfig: {
      shopId: "123456",
      secretKey: "test_secret_key",
      returnUrl: "https://focus-v2.dmnao83.ru/subscription.html",
      paymentsUrl: "https://api.yookassa.test/v3/payments",
      amountValue: "199.00",
      currency: "RUB",
    },
    fetchImpl: async () => {
      throw new Error("network unavailable");
    },
  });
  const baseUrl = await listen(server);
  const accountId = "account-checkout-yookassa-network-failed";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  try {
    const response = await fetch(`${baseUrl}/api/sync/checkout`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify({ featureKey: "voiceTranscription" }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "failed",
      accountId,
      featureKey: "voiceTranscription",
      checkoutUrl: null,
      checkedAt: "2026-07-12T09:14:00.000Z",
      provider: "yookassa",
      error: "provider_unavailable",
    });
    assert.equal(db.getAccountEntitlements(accountId).voiceTranscription.enabled, false);
  } finally {
    await close(server);
    db.close();
  }
});

test("subscription checkout status activates access from a paid YooKassa payment", async () => {
  const db = createSyncDatabase(":memory:");
  const providerCalls = [];
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:15:00.000Z",
    yookassaConfig: {
      shopId: "123456",
      secretKey: "test_secret_key",
      returnUrl: "https://focus-v2.dmnao83.ru/subscription.html",
      paymentsUrl: "https://api.yookassa.test/v3/payments",
      amountValue: "199.00",
      currency: "RUB",
    },
    fetchImpl: async (url, options) => {
      providerCalls.push({ url, options });
      return jsonResponse(200, {
        id: "payment-status-success-123",
        status: "succeeded",
        paid: true,
        metadata: {
          accountId: "account-checkout-status-success",
          featureKey: "voiceTranscription",
        },
      });
    },
  });
  const baseUrl = await listen(server);
  const accountId = "account-checkout-status-success";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  try {
    const response = await fetch(`${baseUrl}/api/sync/checkout/status?paymentId=payment-status-success-123`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      provider: "yookassa",
      accountId,
      paymentId: "payment-status-success-123",
      checkedAt: "2026-07-12T09:15:00.000Z",
      status: "activated",
      featureKey: "voiceTranscription",
      paymentStatus: "succeeded",
      paid: true,
      entitlements: {
        voiceTranscription: {
          enabled: true,
          source: "yookassa",
          updatedAt: "2026-07-12T09:15:00.000Z",
          activatedAt: "2026-07-12T09:15:00.000Z",
          expiresAt: "2026-08-11T09:15:00.000Z",
          paymentId: "payment-status-success-123",
        },
      },
    });
    assert.equal(providerCalls.length, 1);
    assert.equal(providerCalls[0].url, "https://api.yookassa.test/v3/payments/payment-status-success-123");
    assert.equal(providerCalls[0].options.method, "GET");
    assert.equal(providerCalls[0].options.headers.authorization, `Basic ${Buffer.from("123456:test_secret_key").toString("base64")}`);
    assert.equal(db.getAccountEntitlements(accountId).voiceTranscription.enabled, true);
    assert.equal(db.getAccountEntitlements(accountId).voiceTranscription.source, "yookassa");
  } finally {
    await close(server);
    db.close();
  }
});

test("subscription checkout status reports missing YooKassa config", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:16:00.000Z",
    yookassaConfig: null,
  });
  const baseUrl = await listen(server);
  const accountId = "account-checkout-status-missing";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  try {
    const response = await fetch(`${baseUrl}/api/sync/checkout/status?paymentId=payment-status-missing-123`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
    });

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      provider: "yookassa",
      accountId,
      paymentId: "payment-status-missing-123",
      checkedAt: "2026-07-12T09:16:00.000Z",
      status: "provider_not_configured",
      error: "provider_not_configured",
    });
    assert.equal(db.getAccountEntitlements(accountId).voiceTranscription.enabled, false);
  } finally {
    await close(server);
    db.close();
  }
});

test("subscription checkout status keeps pending and mismatched YooKassa payments inactive", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    now: () => "2026-07-12T09:17:00.000Z",
    yookassaConfig: {
      shopId: "123456",
      secretKey: "test_secret_key",
      returnUrl: "https://focus-v2.dmnao83.ru/subscription.html",
      paymentsUrl: "https://api.yookassa.test/v3/payments",
      amountValue: "199.00",
      currency: "RUB",
    },
    fetchImpl: async url => {
      if (String(url).endsWith("/payment-status-pending-123")) {
        return jsonResponse(200, {
          id: "payment-status-pending-123",
          status: "pending",
          paid: false,
          metadata: {
            accountId: "account-checkout-status-guard",
            featureKey: "voiceTranscription",
          },
        });
      }

      return jsonResponse(200, {
        id: "payment-status-mismatch-123",
        status: "succeeded",
        paid: true,
        metadata: {
          accountId: "another-checkout-status-account",
          featureKey: "voiceTranscription",
        },
      });
    },
  });
  const baseUrl = await listen(server);
  const accountId = "account-checkout-status-guard";
  createTestAccount(db, accountId, "2026-07-12T08:00:00.000Z");

  try {
    const pendingResponse = await fetch(`${baseUrl}/api/sync/checkout/status?paymentId=payment-status-pending-123`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
    });
    assert.equal(pendingResponse.status, 200);
    assert.deepEqual(await pendingResponse.json(), {
      provider: "yookassa",
      accountId,
      paymentId: "payment-status-pending-123",
      checkedAt: "2026-07-12T09:17:00.000Z",
      status: "pending",
      featureKey: "voiceTranscription",
      paymentStatus: "pending",
      paid: false,
    });

    const mismatchResponse = await fetch(`${baseUrl}/api/sync/checkout/status?paymentId=payment-status-mismatch-123`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
    });
    assert.equal(mismatchResponse.status, 200);
    assert.deepEqual(await mismatchResponse.json(), {
      provider: "yookassa",
      accountId,
      paymentId: "payment-status-mismatch-123",
      checkedAt: "2026-07-12T09:17:00.000Z",
      status: "ignored",
      reason: "account_mismatch",
      paymentStatus: "succeeded",
      paid: true,
    });
    assert.equal(db.getAccountEntitlements(accountId).voiceTranscription.enabled, false);
  } finally {
    await close(server);
    db.close();
  }
});

test("subscription checkout rejects unknown paid features", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({
    db,
    subscriptionCheckoutUrl: "https://pay.example/checkout",
    yookassaConfig: null,
  });
  const baseUrl = await listen(server);
  const accountId = "account-checkout-invalid";
  createTestAccount(db, accountId);

  try {
    const response = await fetch(`${baseUrl}/api/sync/checkout`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify({ featureKey: "unknownFeature" }),
    });

    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "invalid_paid_feature");
  } finally {
    await close(server);
    db.close();
  }
});

test("sync account profile keeps only recent device sessions", async () => {
  const db = createSyncDatabase(":memory:");
  const ticks = Array.from({ length: 14 }, (_, index) => `2026-07-12T08:${String(index).padStart(2, "0")}:00.000Z`);
  let tickIndex = 0;
  const server = createFocusSyncServer({
    db,
    now: () => ticks[Math.min(tickIndex++, ticks.length - 1)],
  });
  const baseUrl = await listen(server);
  const accountId = "account-device-retention";
  createTestAccount(db, accountId, ticks[0]);

  try {
    let profile = null;

    for (let index = 1; index <= 14; index += 1) {
      const deviceId = `device-${String(index).padStart(2, "0")}`;
      const response = await fetch(`${baseUrl}/api/sync/account`, {
        headers: {
          "x-focus-account": accountId,
          "x-focus-device": deviceId,
          "x-focus-device-name": encodeURIComponent(`Device ${index}`),
        },
      });

      assert.equal(response.status, 200);
      profile = await response.json();

      if (index === 1) {
        db.savePushSubscription({
          accountId,
          deviceId,
          subscription: createPushSubscription("https://push.example/send/device-01"),
          updatedAt: ticks[0],
        });
      }
    }

    const deviceIds = profile.devices.map(device => device.deviceId);
    const expectedDeviceIds = Array.from({ length: 12 }, (_, index) => `device-${String(14 - index).padStart(2, "0")}`);

    assert.deepEqual(deviceIds, expectedDeviceIds);
    assert.equal(profile.currentDeviceId, "device-14");
    assert.equal(profile.devices[0].isCurrent, true);
    assert.equal(db.listDeviceSessions(accountId).length, 12);
    assert.equal(db.getPushSubscriptions(accountId).some(subscription => subscription.deviceId === "device-01"), true);
  } finally {
    await close(server);
    db.close();
  }
});

test("sync API disconnects the current device and removes its push subscriptions", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({ db });
  const baseUrl = await listen(server);
  const accountId = "account-device-disconnect";
  createTestAccount(db, accountId);

  try {
    await fetch(`${baseUrl}/api/sync/account`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
        "x-focus-device-name": encodeURIComponent("Ноутбук"),
      },
    });
    await fetch(`${baseUrl}/api/sync/account`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "phone",
        "x-focus-device-name": encodeURIComponent("iPhone"),
      },
    });
    db.savePushSubscription({
      accountId,
      deviceId: "desktop",
      subscription: createPushSubscription("https://push.example/send/desktop"),
      updatedAt: "2026-07-10T10:00:00.000Z",
    });
    db.savePushSubscription({
      accountId,
      deviceId: "phone",
      subscription: createPushSubscription("https://push.example/send/phone"),
      updatedAt: "2026-07-10T10:00:00.000Z",
    });

    const response = await fetch(`${baseUrl}/api/sync/devices/current`, {
      method: "DELETE",
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "phone",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      disconnected: true,
      accountId,
      deviceId: "phone",
      removedDeviceSessions: 1,
      removedPushSubscriptions: 1,
    });
    assert.equal(db.getPushSubscriptions(accountId).length, 1);
    assert.equal(db.getPushSubscriptions(accountId)[0].deviceId, "desktop");

    const profileResponse = await fetch(`${baseUrl}/api/sync/account`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
    });
    const profile = await profileResponse.json();
    assert.deepEqual(profile.devices.map(device => device.deviceId), ["desktop"]);
  } finally {
    await close(server);
    db.close();
  }
});

test("sync API removes empty push subscription buckets after current device disconnect", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({ db });
  const baseUrl = await listen(server);
  const accountId = "account-device-disconnect-empty-push";
  createTestAccount(db, accountId);

  try {
    await fetch(`${baseUrl}/api/sync/account`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "phone",
      },
    });
    db.savePushSubscription({
      accountId,
      deviceId: "phone",
      subscription: createPushSubscription("https://push.example/send/only-phone"),
      updatedAt: "2026-07-10T10:00:00.000Z",
    });

    const response = await fetch(`${baseUrl}/api/sync/devices/current`, {
      method: "DELETE",
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "phone",
      },
    });

    assert.equal(response.status, 200);
    assert.equal((await response.json()).removedPushSubscriptions, 1);
    assert.equal(db.getPushSubscriptions(accountId).length, 0);
    assert.equal(db.state.pushSubscriptions[accountId], undefined);
  } finally {
    await close(server);
    db.close();
  }
});

test("sync database persists schedule snapshots across server restarts", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "focus-sync-"));
  const dbPath = join(tempDir, "sync.json");
  const accountId = "account-persisted";
  const schedules = [{ id: "persisted", title: "Persisted schedule" }];

  try {
    const firstDb = createSyncDatabase(dbPath);
    const firstServer = createFocusSyncServer({ db: firstDb });
    const firstBaseUrl = await listen(firstServer);
    createTestAccount(firstDb, accountId);

    const putResponse = await fetch(`${firstBaseUrl}/api/sync/schedules`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify({ schedules }),
    });
    assert.equal(putResponse.status, 200);

    await close(firstServer);
    firstDb.close();

    const secondDb = createSyncDatabase(dbPath);
    const secondServer = createFocusSyncServer({ db: secondDb });
    const secondBaseUrl = await listen(secondServer);

    const getResponse = await fetch(`${secondBaseUrl}/api/sync/schedules`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "phone",
      },
    });

    assert.equal(getResponse.status, 200);
    const snapshot = await getResponse.json();
    assert.equal(snapshot.revision, 1);
    assert.deepEqual(snapshot.schedules, schedules);

    await close(secondServer);
    secondDb.close();
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("sync database preserves corrupt JSON before starting fresh", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "focus-sync-corrupt-"));
  const dbPath = join(tempDir, "sync.json");
  const corruptJson = "{ not valid json";

  try {
    writeFileSync(dbPath, corruptJson, "utf8");

    const db = createSyncDatabase(dbPath);
    db.createAccount({
      accountId: "account-recovered",
      displayName: "Recovered account",
      createdAt: "2026-07-28T10:00:00.000Z",
    });
    db.close();

    const files = readdirSync(tempDir);
    const corruptFiles = files.filter(fileName => fileName.startsWith("sync.json.corrupt-"));
    assert.equal(corruptFiles.length, 1);
    assert.equal(readFileSync(join(tempDir, corruptFiles[0]), "utf8"), corruptJson);

    const freshState = JSON.parse(readFileSync(dbPath, "utf8"));
    assert.equal(freshState.accounts["account-recovered"].displayName, "Recovered account");
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("sync API shares reminders across devices", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({ db });
  const baseUrl = await listen(server);
  const accountId = "account-reminders";
  createTestAccount(db, accountId);
  const reminders = [{ id: "reminder-1", title: "Call Sergey", scheduledAt: "2026-07-11T09:30:00.000Z" }];

  try {
    const putResponse = await fetch(`${baseUrl}/api/sync/reminders`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify({ reminders }),
    });

    assert.equal(putResponse.status, 200);
    assert.equal((await putResponse.json()).revision, 1);

    const getResponse = await fetch(`${baseUrl}/api/sync/reminders`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "phone",
      },
    });

    assert.equal(getResponse.status, 200);
    const snapshot = await getResponse.json();
    assert.equal(snapshot.revision, 1);
    assert.deepEqual(snapshot.reminders, reminders);
  } finally {
    await close(server);
    db.close();
  }
});

test("sync API shares today tasks across devices", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({ db });
  const baseUrl = await listen(server);
  const accountId = "account-tasks";
  createTestAccount(db, accountId);
  const tasks = [{ id: "task-1", title: "Prepare documents", label: "Work", dateKey: "2026-07-11" }];

  try {
    const putResponse = await fetch(`${baseUrl}/api/sync/tasks`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify({ tasks }),
    });

    assert.equal(putResponse.status, 200);
    assert.equal((await putResponse.json()).revision, 1);

    const getResponse = await fetch(`${baseUrl}/api/sync/tasks`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "phone",
      },
    });

    assert.equal(getResponse.status, 200);
    const snapshot = await getResponse.json();
    assert.equal(snapshot.revision, 1);
    assert.deepEqual(snapshot.tasks, tasks);
  } finally {
    await close(server);
    db.close();
  }
});

test("sync API shares notes across devices", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({ db });
  const baseUrl = await listen(server);
  const accountId = "account-notes";
  createTestAccount(db, accountId);
  const notes = [{ id: "note-1", body: "Идея для недели", createdAt: "2026-07-11T10:00:00.000Z" }];

  try {
    const putResponse = await fetch(`${baseUrl}/api/sync/notes`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify({ notes }),
    });

    assert.equal(putResponse.status, 200);
    assert.equal((await putResponse.json()).revision, 1);

    const getResponse = await fetch(`${baseUrl}/api/sync/notes`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "phone",
      },
    });

    assert.equal(getResponse.status, 200);
    const snapshot = await getResponse.json();
    assert.equal(snapshot.revision, 1);
    assert.deepEqual(snapshot.notes, notes);
  } finally {
    await close(server);
    db.close();
  }
});

test("sync API shares birthdays across devices", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({ db });
  const baseUrl = await listen(server);
  const accountId = "account-birthdays";
  createTestAccount(db, accountId);
  const birthdays = [{ id: "birthday-1", name: "Анна", dateOfBirth: "1990-07-11", reminderEnabled: true }];

  try {
    const putResponse = await fetch(`${baseUrl}/api/sync/birthdays`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify({ birthdays }),
    });

    assert.equal(putResponse.status, 200);
    assert.equal((await putResponse.json()).revision, 1);

    const getResponse = await fetch(`${baseUrl}/api/sync/birthdays`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "phone",
      },
    });

    assert.equal(getResponse.status, 200);
    const snapshot = await getResponse.json();
    assert.equal(snapshot.revision, 1);
    assert.deepEqual(snapshot.birthdays, birthdays);
  } finally {
    await close(server);
    db.close();
  }
});

test("sync API shares diary entries across devices", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({ db });
  const baseUrl = await listen(server);
  const accountId = "account-diary";
  createTestAccount(db, accountId);
  const entries = [{ id: "diary-1", dateKey: "2026-07-11", heading: "Итоги дня", text: "Спокойный фокус" }];

  try {
    const putResponse = await fetch(`${baseUrl}/api/sync/diary`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify({ entries }),
    });

    assert.equal(putResponse.status, 200);
    assert.equal((await putResponse.json()).revision, 1);

    const getResponse = await fetch(`${baseUrl}/api/sync/diary`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "phone",
      },
    });

    assert.equal(getResponse.status, 200);
    const snapshot = await getResponse.json();
    assert.equal(snapshot.revision, 1);
    assert.deepEqual(snapshot.entries, entries);
  } finally {
    await close(server);
    db.close();
  }
});

test("push API stores a device subscription for an account", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({ db, pushPublicKey: "public-key" });
  const baseUrl = await listen(server);
  const subscription = {
    endpoint: "https://push.example/send/1",
    expirationTime: 12345,
    extraField: "should-not-be-saved",
    keys: {
      p256dh: "p256dh-key",
      auth: "auth-key",
      ignored: "should-not-be-saved",
    },
  };
  createTestAccount(db, "account-push");

  try {
    const configResponse = await fetch(`${baseUrl}/api/push/config`);
    assert.equal(configResponse.status, 200);
    assert.deepEqual(await configResponse.json(), { configured: true, publicKey: "public-key" });

    const saveResponse = await fetch(`${baseUrl}/api/push/subscriptions`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-focus-account": "account-push",
        "x-focus-device": "desktop",
      },
      body: JSON.stringify({ subscription }),
    });

    assert.equal(saveResponse.status, 200);
    assert.deepEqual(await saveResponse.json(), { saved: true, subscriptions: 1 });
    assert.deepEqual(db.getPushSubscriptions("account-push")[0], {
      accountId: "account-push",
      deviceId: "desktop",
      endpoint: subscription.endpoint,
      expirationTime: 12345,
      keys: {
        p256dh: "p256dh-key",
        auth: "auth-key",
      },
      updatedAt: db.getPushSubscriptions("account-push")[0].updatedAt,
    });

    const renewedSubscription = createPushSubscription("https://push.example/send/renewed");
    const renewResponse = await fetch(`${baseUrl}/api/push/subscriptions`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-focus-account": "account-push",
        "x-focus-device": "desktop",
      },
      body: JSON.stringify({ subscription: renewedSubscription }),
    });

    assert.equal(renewResponse.status, 200);
    assert.deepEqual(await renewResponse.json(), { saved: true, subscriptions: 1 });
    assert.equal(db.getPushSubscriptions("account-push").length, 1);
    assert.equal(db.getPushSubscriptions("account-push")[0].endpoint, renewedSubscription.endpoint);

    const statusResponse = await fetch(`${baseUrl}/api/push/subscriptions/status`, {
      headers: {
        "x-focus-account": "account-push",
        "x-focus-device": "desktop",
      },
    });

    assert.equal(statusResponse.status, 200);
    assert.deepEqual(await statusResponse.json(), {
      configured: true,
      accountId: "account-push",
      deviceId: "desktop",
      subscriptions: 1,
      deviceSubscriptions: 1,
      deviceRegistered: true,
      updatedAt: db.getPushSubscriptions("account-push")[0].updatedAt,
    });
  } finally {
    await close(server);
    db.close();
  }
});

test("push API rejects oversized subscriptions", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({ db, pushPublicKey: "public-key" });
  const baseUrl = await listen(server);
  const accountId = "account-push-oversized";
  createTestAccount(db, accountId);

  try {
    const response = await fetch(`${baseUrl}/api/push/subscriptions`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify({
        subscription: createPushSubscription(`https://push.example/send/${"x".repeat(4096)}`),
      }),
    });

    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "invalid_push_subscription");
    assert.equal(db.getPushSubscriptions(accountId).length, 0);
  } finally {
    await close(server);
    db.close();
  }
});

test("push API sends a test notification to the current device", async () => {
  const db = createSyncDatabase(":memory:");
  const deliveries = [];
  const server = createFocusSyncServer({
    db,
    pushPublicKey: "public-key",
    pushSender: async delivery => {
      deliveries.push(delivery);
      return { ok: true, statusCode: 201 };
    },
  });
  const baseUrl = await listen(server);
  const accountId = "account-test-push";
  const deviceId = "desktop";
  createTestAccount(db, accountId);

  try {
    db.savePushSubscription({
      accountId,
      deviceId,
      subscription: createPushSubscription("https://push.example/send/test"),
      updatedAt: "2026-07-10T10:00:00.000Z",
    });

    const response = await fetch(`${baseUrl}/api/push/test`, {
      method: "POST",
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": deviceId,
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      sent: 1,
      failed: 0,
      removed: 0,
      deviceSubscriptions: 1,
    });
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0].payload.type, "focus-test");
    assert.equal(deliveries[0].ttl, 60);

    const eventsResponse = await fetch(`${baseUrl}/api/push/events`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": deviceId,
      },
    });
    assert.equal(eventsResponse.status, 200);
    const events = await eventsResponse.json();
    assert.equal(events.events.length, 1);
    assert.equal(events.events[0].type, "test");
    assert.equal(events.events[0].status, "sent");
    assert.equal(events.events[0].sent, 1);
    assert.equal(events.events[0].failed, 0);
  } finally {
    await close(server);
    db.close();
  }
});

test("push reminder diagnostics reports delivery states for the account", async () => {
  const db = createSyncDatabase(":memory:");
  const now = () => "2026-07-10T10:00:00.000Z";
  const server = createFocusSyncServer({ db, now });
  const baseUrl = await listen(server);
  const accountId = "account-push-reminder-diagnostics";
  createTestAccount(db, accountId);
  const alreadySentReminder = {
    id: "reminder-already-sent",
    title: "Already sent",
    scheduledAt: "2026-07-10T09:55:00.000Z",
    deliveredAt: null,
  };

  try {
    db.saveReminderSnapshot({
      accountId,
      reminders: [
        { id: "reminder-invalid", title: "Invalid", scheduledAt: "not-a-date", deliveredAt: null },
        { id: "reminder-pending", title: "Future", scheduledAt: "2026-07-10T10:01:00.000Z", deliveredAt: null },
        { id: "reminder-expired", title: "Old", scheduledAt: "2026-06-30T10:00:00.000Z", deliveredAt: null },
        { id: "reminder-delivered", title: "Done", scheduledAt: "2026-07-10T09:50:00.000Z", deliveredAt: "2026-07-10T09:50:30.000Z" },
        alreadySentReminder,
        { id: "reminder-no-subscriptions", title: "No subscribers", scheduledAt: "2026-07-10T09:58:00.000Z", deliveredAt: null },
      ],
      updatedAt: now(),
    });
    db.savePushDelivery({
      accountId,
      deliveryKey: `${alreadySentReminder.id}:${alreadySentReminder.scheduledAt}`,
      reminderId: alreadySentReminder.id,
      scheduledAt: alreadySentReminder.scheduledAt,
      sentAt: now(),
      deliveryCount: 1,
    });

    const response = await fetch(`${baseUrl}/api/push/reminders/status`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
    });

    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.status, "ok");
    assert.equal(result.checkedAt, now());
    assert.equal(result.subscriptions, 0);
    assert.deepEqual(result.stats, {
      scanned: 6,
      due: 0,
      noSubscriptions: 1,
      expired: 1,
      pending: 1,
      alreadyDelivered: 1,
      alreadySent: 1,
      retrying: 0,
      retryExhausted: 0,
      invalid: 1,
    });
    assert.equal(result.attention.length, 3);
    assert.deepEqual(result.attention.map(item => item.state), ["invalid", "expired", "noSubscriptions"]);
    assert.equal(result.next.id, "reminder-pending");
  } finally {
    await close(server);
    db.close();
  }
});

test("push dispatcher sends due reminders once", async () => {
  const db = createSyncDatabase(":memory:");
  const deliveries = [];
  const now = () => "2026-07-10T10:00:00.000Z";
  const accountId = "account-push-due";
  const reminder = {
    id: "reminder-due",
    title: "Call Sergey",
    scheduledAt: "2026-07-10T09:59:00.000Z",
    deliveredAt: null,
  };

  db.saveReminderSnapshot({
    accountId,
    reminders: [reminder],
    updatedAt: now(),
  });
  db.savePushSubscription({
    accountId,
    deviceId: "desktop",
    subscription: createPushSubscription("https://push.example/send/due"),
    updatedAt: now(),
  });

  const firstRun = await dispatchDueReminders({
    db,
    now,
    pushSender: async delivery => {
      deliveries.push(delivery);
      return { ok: true, statusCode: 201 };
    },
  });
  const secondRun = await dispatchDueReminders({
    db,
    now,
    pushSender: async delivery => {
      deliveries.push(delivery);
      return { ok: true, statusCode: 201 };
    },
  });

  assert.equal(firstRun.sent, 1);
  assert.equal(firstRun.due, 1);
  assert.equal(firstRun.delivered, 1);
  assert.equal(secondRun.sent, 0);
  assert.equal(secondRun.alreadyDelivered, 1);
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].payload.body, reminder.title);
  assert.equal(deliveries[0].payload.reminderId, reminder.id);
  const events = db.listPushEvents(accountId);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "reminder");
  assert.equal(events[0].status, "sent");
  assert.equal(events[0].reminderId, reminder.id);
  assert.equal(events[0].sent, 1);
  const deliveredSnapshot = db.getReminderSnapshot(accountId);
  assert.equal(deliveredSnapshot.revision, 2);
  assert.equal(deliveredSnapshot.updatedAt, now());
  assert.equal(deliveredSnapshot.reminders[0].deliveredAt, now());
});

test("push dispatcher retries transient reminder failures after the retry delay", async () => {
  const db = createSyncDatabase(":memory:");
  const deliveries = [];
  let nowValue = "2026-07-10T10:00:00.000Z";
  const now = () => nowValue;
  const accountId = "account-push-retry";
  const reminder = {
    id: "reminder-retry",
    title: "Retry me",
    scheduledAt: "2026-07-10T09:59:00.000Z",
    deliveredAt: null,
  };
  const deliveryKey = `${reminder.id}:${reminder.scheduledAt}`;
  const pushResults = [
    { ok: false, statusCode: 503 },
    { ok: true, statusCode: 201 },
  ];
  const pushSender = async delivery => {
    deliveries.push(delivery);
    return pushResults.shift();
  };

  db.saveReminderSnapshot({
    accountId,
    reminders: [reminder],
    updatedAt: now(),
  });
  db.savePushSubscription({
    accountId,
    deviceId: "phone",
    subscription: createPushSubscription("https://push.example/send/retry"),
    updatedAt: now(),
  });

  const firstRun = await dispatchDueReminders({
    db,
    now,
    retryDelayMs: 5 * 60 * 1000,
    retryMaxAttempts: 3,
    pushSender,
  });

  assert.equal(firstRun.failed, 1);
  assert.equal(firstRun.retrying, 1);
  assert.equal(firstRun.delivered, 0);
  assert.equal(db.hasPushDelivery(accountId, deliveryKey), false);
  const retry = db.getPushRetry(accountId, deliveryKey);
  assert.equal(retry.attempts, 1);
  assert.equal(retry.maxAttempts, 3);
  assert.equal(retry.nextRetryAt, "2026-07-10T10:05:00.000Z");
  assert.equal(db.getReminderSnapshot(accountId).revision, 1);
  assert.equal(db.getReminderSnapshot(accountId).reminders[0].deliveredAt, null);

  const skippedRun = await dispatchDueReminders({
    db,
    now,
    retryDelayMs: 5 * 60 * 1000,
    retryMaxAttempts: 3,
    pushSender: async () => {
      throw new Error("Retry should wait until nextRetryAt.");
    },
  });

  assert.equal(skippedRun.sent, 0);
  assert.equal(skippedRun.retrying, 1);
  assert.equal(deliveries.length, 1);

  nowValue = "2026-07-10T10:05:00.000Z";
  const secondRun = await dispatchDueReminders({
    db,
    now,
    retryDelayMs: 5 * 60 * 1000,
    retryMaxAttempts: 3,
    pushSender,
  });

  assert.equal(secondRun.sent, 1);
  assert.equal(secondRun.delivered, 1);
  assert.equal(db.getPushRetry(accountId, deliveryKey), null);
  assert.equal(db.hasPushDelivery(accountId, deliveryKey), true);
  const deliveredSnapshot = db.getReminderSnapshot(accountId);
  assert.equal(deliveredSnapshot.revision, 2);
  assert.equal(deliveredSnapshot.reminders[0].deliveredAt, nowValue);

  const events = db.listPushEvents(accountId);
  assert.equal(events.length, 2);
  assert.equal(events[0].status, "sent");
  assert.equal(events[0].attempts, 2);
  assert.equal(events[1].status, "failed");
  assert.equal(events[1].attempts, 1);
  assert.equal(events[1].maxAttempts, 3);
  assert.equal(events[1].nextRetryAt, "2026-07-10T10:05:00.000Z");
});

test("push dispatcher stops retrying transient reminder failures after the attempt limit", async () => {
  const db = createSyncDatabase(":memory:");
  const deliveries = [];
  const now = () => "2026-07-10T10:00:00.000Z";
  const accountId = "account-push-retry-exhausted";
  createTestAccount(db, accountId);
  const reminder = {
    id: "reminder-retry-exhausted",
    title: "Stop retrying",
    scheduledAt: "2026-07-10T09:59:00.000Z",
    deliveredAt: null,
  };
  const deliveryKey = `${reminder.id}:${reminder.scheduledAt}`;
  const pushSender = async delivery => {
    deliveries.push(delivery);
    return { ok: false, statusCode: 503 };
  };

  db.saveReminderSnapshot({
    accountId,
    reminders: [reminder],
    updatedAt: now(),
  });
  db.savePushSubscription({
    accountId,
    deviceId: "phone",
    subscription: createPushSubscription("https://push.example/send/retry-exhausted"),
    updatedAt: now(),
  });

  const firstRun = await dispatchDueReminders({
    db,
    now,
    retryDelayMs: 0,
    retryMaxAttempts: 3,
    pushSender,
  });
  const secondRun = await dispatchDueReminders({
    db,
    now,
    retryDelayMs: 0,
    retryMaxAttempts: 3,
    pushSender,
  });
  const thirdRun = await dispatchDueReminders({
    db,
    now,
    retryDelayMs: 0,
    retryMaxAttempts: 3,
    pushSender,
  });

  assert.equal(firstRun.retrying, 1);
  assert.equal(secondRun.retrying, 1);
  assert.equal(thirdRun.retryExhausted, 1);
  assert.equal(thirdRun.delivered, 0);
  assert.equal(deliveries.length, 3);
  assert.equal(db.getPushRetry(accountId, deliveryKey), null);
  const failure = db.getPushFailure(accountId, deliveryKey);
  assert.equal(failure.attempts, 3);
  assert.equal(failure.maxAttempts, 3);
  assert.equal(failure.failedAt, now());
  const events = db.listPushEvents(accountId);
  assert.equal(events[0].status, "retry-exhausted");
  assert.equal(events[0].attempts, 3);
  assert.equal(events[0].maxAttempts, 3);

  const fourthRun = await dispatchDueReminders({
    db,
    now,
    retryDelayMs: 0,
    retryMaxAttempts: 3,
    pushSender: async () => {
      throw new Error("Retry should stop after the attempt limit.");
    },
  });

  assert.equal(fourthRun.sent, 0);
  assert.equal(fourthRun.failed, 0);
  assert.equal(fourthRun.retryExhausted, 1);
  assert.equal(deliveries.length, 3);

  const server = createFocusSyncServer({ db, now });
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/push/reminders/status`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
    });

    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.stats.retryExhausted, 1);
    assert.equal(result.attention[0].state, "retryExhausted");
    assert.equal(result.attention[0].failure.attempts, 3);
    assert.equal(result.attention[0].failure.maxAttempts, 3);
  } finally {
    await close(server);
    db.close();
  }
});

test("sync API preserves delivered reminder state from stale client pushes", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({ db });
  const baseUrl = await listen(server);
  const deliveries = [];
  const now = () => "2026-07-10T10:00:00.000Z";
  const accountId = "account-stale-delivery";
  createTestAccount(db, accountId);
  const reminder = {
    id: "reminder-stale",
    title: "Call Sergey",
    scheduledAt: "2026-07-10T09:59:00.000Z",
    deliveredAt: null,
  };

  try {
    db.saveReminderSnapshot({
      accountId,
      reminders: [reminder],
      updatedAt: now(),
    });
    db.savePushSubscription({
      accountId,
      deviceId: "phone",
      subscription: createPushSubscription("https://push.example/send/stale"),
      updatedAt: now(),
    });

    await dispatchDueReminders({
      db,
      now,
      pushSender: async delivery => {
        deliveries.push(delivery);
        return { ok: true, statusCode: 201 };
      },
    });

    const staleResponse = await fetch(`${baseUrl}/api/sync/reminders`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify({
        reminders: [{ ...reminder, title: "Call Sergey later", deliveredAt: null }],
      }),
    });

    assert.equal(staleResponse.status, 200);
    const staleSnapshot = await staleResponse.json();
    assert.equal(staleSnapshot.reminders[0].title, "Call Sergey later");
    assert.equal(staleSnapshot.reminders[0].deliveredAt, now());

    const secondRun = await dispatchDueReminders({
      db,
      now,
      pushSender: async delivery => {
        deliveries.push(delivery);
        return { ok: true, statusCode: 201 };
      },
    });

    assert.equal(secondRun.sent, 0);
    assert.equal(deliveries.length, 1);
  } finally {
    await close(server);
    db.close();
  }
});

test("sync API prunes push state for removed reminders", async () => {
  const db = createSyncDatabase(":memory:");
  const server = createFocusSyncServer({ db });
  const baseUrl = await listen(server);
  const now = () => "2026-07-28T10:00:00.000Z";
  const accountId = "account-prune-reminder-state";
  createTestAccount(db, accountId);
  const reminders = [
    { id: "keep-delivery", title: "Keep delivered", scheduledAt: "2026-07-28T09:00:00.000Z" },
    { id: "keep-retry", title: "Keep retry", scheduledAt: "2026-07-28T09:05:00.000Z" },
    { id: "keep-failure", title: "Keep failure", scheduledAt: "2026-07-28T09:10:00.000Z" },
    { id: "remove-delivery", title: "Remove delivered", scheduledAt: "2026-07-28T09:15:00.000Z" },
    { id: "remove-retry", title: "Remove retry", scheduledAt: "2026-07-28T09:20:00.000Z" },
    { id: "remove-failure", title: "Remove failure", scheduledAt: "2026-07-28T09:25:00.000Z" },
  ];
  const deliveryKey = reminder => `${reminder.id}:${reminder.scheduledAt}`;

  try {
    db.saveReminderSnapshot({ accountId, reminders, updatedAt: now() });
    db.savePushDelivery({
      accountId,
      deliveryKey: deliveryKey(reminders[0]),
      reminderId: reminders[0].id,
      scheduledAt: reminders[0].scheduledAt,
      sentAt: now(),
      deliveryCount: 1,
    });
    db.savePushRetry({
      accountId,
      deliveryKey: deliveryKey(reminders[1]),
      reminderId: reminders[1].id,
      scheduledAt: reminders[1].scheduledAt,
      attempts: 1,
      maxAttempts: 3,
      lastAttemptAt: now(),
      nextRetryAt: "2026-07-28T10:05:00.000Z",
      failed: 1,
      removed: 0,
      subscriptions: 1,
    });
    db.savePushFailure({
      accountId,
      deliveryKey: deliveryKey(reminders[2]),
      reminderId: reminders[2].id,
      scheduledAt: reminders[2].scheduledAt,
      attempts: 3,
      maxAttempts: 3,
      failedAt: now(),
      failed: 3,
      removed: 0,
      subscriptions: 1,
    });
    db.savePushDelivery({
      accountId,
      deliveryKey: deliveryKey(reminders[3]),
      reminderId: reminders[3].id,
      scheduledAt: reminders[3].scheduledAt,
      sentAt: now(),
      deliveryCount: 1,
    });
    db.savePushRetry({
      accountId,
      deliveryKey: deliveryKey(reminders[4]),
      reminderId: reminders[4].id,
      scheduledAt: reminders[4].scheduledAt,
      attempts: 1,
      maxAttempts: 3,
      lastAttemptAt: now(),
      nextRetryAt: "2026-07-28T10:05:00.000Z",
      failed: 1,
      removed: 0,
      subscriptions: 1,
    });
    db.savePushFailure({
      accountId,
      deliveryKey: deliveryKey(reminders[5]),
      reminderId: reminders[5].id,
      scheduledAt: reminders[5].scheduledAt,
      attempts: 3,
      maxAttempts: 3,
      failedAt: now(),
      failed: 3,
      removed: 0,
      subscriptions: 1,
    });

    const saveResponse = await fetch(`${baseUrl}/api/sync/reminders`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
      body: JSON.stringify({ reminders: reminders.slice(0, 3) }),
    });

    assert.equal(saveResponse.status, 200);
    assert.equal(db.hasPushDelivery(accountId, deliveryKey(reminders[0])), true);
    assert.ok(db.getPushRetry(accountId, deliveryKey(reminders[1])));
    assert.ok(db.getPushFailure(accountId, deliveryKey(reminders[2])));
    assert.equal(db.hasPushDelivery(accountId, deliveryKey(reminders[3])), false);
    assert.equal(db.getPushRetry(accountId, deliveryKey(reminders[4])), null);
    assert.equal(db.getPushFailure(accountId, deliveryKey(reminders[5])), null);
  } finally {
    await close(server);
    db.close();
  }
});

test("push dispatcher reports skipped reminder delivery reasons", async () => {
  const db = createSyncDatabase(":memory:");
  const now = () => "2026-07-10T10:00:00.000Z";
  const accountId = "account-push-diagnostics";
  const alreadySentReminder = {
    id: "reminder-already-sent",
    title: "Already sent",
    scheduledAt: "2026-07-10T09:55:00.000Z",
    deliveredAt: null,
  };

  db.saveReminderSnapshot({
    accountId,
    reminders: [
      { id: "reminder-invalid", title: "Invalid", scheduledAt: "not-a-date", deliveredAt: null },
      { id: "reminder-pending", title: "Future", scheduledAt: "2026-07-10T10:01:00.000Z", deliveredAt: null },
      { id: "reminder-expired", title: "Old", scheduledAt: "2026-06-30T10:00:00.000Z", deliveredAt: null },
      { id: "reminder-delivered", title: "Done", scheduledAt: "2026-07-10T09:50:00.000Z", deliveredAt: "2026-07-10T09:50:30.000Z" },
      alreadySentReminder,
      { id: "reminder-no-subscriptions", title: "No subscribers", scheduledAt: "2026-07-10T09:58:00.000Z", deliveredAt: null },
    ],
    updatedAt: now(),
  });
  db.savePushDelivery({
    accountId,
    deliveryKey: `${alreadySentReminder.id}:${alreadySentReminder.scheduledAt}`,
    reminderId: alreadySentReminder.id,
    scheduledAt: alreadySentReminder.scheduledAt,
    sentAt: now(),
    deliveryCount: 1,
  });

  const result = await dispatchDueReminders({
    db,
    now,
    pushSender: async () => {
      throw new Error("No delivery should be attempted without subscriptions.");
    },
  });

  assert.equal(result.scanned, 6);
  assert.equal(result.invalid, 1);
  assert.equal(result.pending, 1);
  assert.equal(result.expired, 1);
  assert.equal(result.alreadyDelivered, 1);
  assert.equal(result.alreadySent, 1);
  assert.equal(result.due, 1);
  assert.equal(result.noSubscriptions, 1);
  assert.equal(result.sent, 0);
  assert.equal(result.failed, 0);
  assert.equal(result.delivered, 0);
  assert.equal(db.getReminderSnapshot(accountId).revision, 1);
});

test("push dispatcher removes expired subscriptions", async () => {
  const db = createSyncDatabase(":memory:");
  const now = () => "2026-07-10T10:00:00.000Z";
  const accountId = "account-push-expired";

  db.saveReminderSnapshot({
    accountId,
    reminders: [{
      id: "reminder-expired-subscription",
      title: "Training",
      scheduledAt: "2026-07-10T09:59:00.000Z",
      deliveredAt: null,
    }],
    updatedAt: now(),
  });
  db.savePushSubscription({
    accountId,
    deviceId: "phone",
    subscription: createPushSubscription("https://push.example/send/expired"),
    updatedAt: now(),
  });

  const result = await dispatchDueReminders({
    db,
    now,
    pushSender: async () => ({ ok: false, statusCode: 410 }),
  });

  assert.equal(result.failed, 1);
  assert.equal(result.removed, 1);
  assert.equal(db.getPushSubscriptions(accountId).length, 0);
  assert.equal(db.state.pushSubscriptions[accountId], undefined);
  assert.equal(db.getPushRetry(accountId, "reminder-expired-subscription:2026-07-10T09:59:00.000Z"), null);
  const snapshot = db.getReminderSnapshot(accountId);
  assert.equal(snapshot.revision, 1);
  assert.equal(snapshot.reminders[0].deliveredAt, null);
});

test("push state cleanup removes empty retry and failure buckets", () => {
  const db = createSyncDatabase(":memory:");
  const accountId = "account-push-state-cleanup";
  const deliveryKey = "reminder-cleanup:2026-07-10T09:59:00.000Z";

  try {
    db.savePushRetry({
      accountId,
      deliveryKey,
      reminderId: "reminder-cleanup",
      scheduledAt: "2026-07-10T09:59:00.000Z",
      attempts: 1,
      maxAttempts: 3,
      lastAttemptAt: "2026-07-10T10:00:00.000Z",
      nextRetryAt: "2026-07-10T10:05:00.000Z",
      failed: 1,
      removed: 0,
      subscriptions: 1,
    });
    db.clearPushRetry({ accountId, deliveryKey });
    assert.equal(db.state.pushRetries[accountId], undefined);

    db.savePushRetry({
      accountId,
      deliveryKey,
      reminderId: "reminder-cleanup",
      scheduledAt: "2026-07-10T09:59:00.000Z",
      attempts: 1,
      maxAttempts: 3,
      lastAttemptAt: "2026-07-10T10:00:00.000Z",
      nextRetryAt: "2026-07-10T10:05:00.000Z",
      failed: 1,
      removed: 0,
      subscriptions: 1,
    });
    db.savePushFailure({
      accountId,
      deliveryKey,
      reminderId: "reminder-cleanup",
      scheduledAt: "2026-07-10T09:59:00.000Z",
      attempts: 3,
      maxAttempts: 3,
      failedAt: "2026-07-10T10:10:00.000Z",
      failed: 1,
      removed: 0,
      subscriptions: 1,
    });
    assert.equal(db.state.pushRetries[accountId], undefined);
    assert.ok(db.state.pushFailures[accountId]?.[deliveryKey]);

    db.savePushDelivery({
      accountId,
      deliveryKey,
      reminderId: "reminder-cleanup",
      scheduledAt: "2026-07-10T09:59:00.000Z",
      sentAt: "2026-07-10T10:15:00.000Z",
      deliveryCount: 1,
    });
    assert.equal(db.state.pushFailures[accountId], undefined);
    assert.ok(db.state.pushDeliveries[accountId]?.[deliveryKey]);
  } finally {
    db.close();
  }
});

test("background push dispatcher logs unexpected failures", async () => {
  const db = createSyncDatabase(":memory:");
  const failure = new Error("snapshot storage failed");
  const loggerCalls = [];
  db.listReminderSnapshots = () => {
    throw failure;
  };

  try {
    const result = await runBackgroundReminderDispatch({
      db,
      now: () => "2026-07-10T10:00:00.000Z",
      pushSender: async () => ({ ok: true }),
      logger: {
        error: (...args) => loggerCalls.push(args),
      },
    });

    assert.equal(loggerCalls.length, 1);
    assert.equal(loggerCalls[0][0], "Focus reminder dispatch failed.");
    assert.equal(loggerCalls[0][1], failure);
    assert.equal(result.scanned, 0);
    assert.equal(result.failed, 0);
  } finally {
    db.close();
  }
});

test("background push dispatcher ignores logger failures", async () => {
  const db = createSyncDatabase(":memory:");
  let loggerCalls = 0;
  db.listReminderSnapshots = () => {
    throw new Error("snapshot storage failed");
  };

  try {
    const result = await runBackgroundReminderDispatch({
      db,
      now: () => "2026-07-10T10:00:00.000Z",
      pushSender: async () => ({ ok: true }),
      logger: {
        error: () => {
          loggerCalls += 1;
          throw new Error("logger failed");
        },
      },
    });

    assert.equal(loggerCalls, 1);
    assert.equal(result.scanned, 0);
    assert.equal(result.failed, 0);
  } finally {
    db.close();
  }
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

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", chunk => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function sendTestJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

function createTestAccount(db, accountId, createdAt = "2026-07-10T00:00:00.000Z") {
  db.createAccount({ accountId, displayName: null, createdAt });
  return accountId;
}

function createYooKassaPaymentNotification({
  accountId,
  featureKey = "voiceTranscription",
  event = "payment.succeeded",
  status = "succeeded",
  paid = true,
  paymentId = "2f295ff7-000f-5000-9000-000000000001",
} = {}) {
  return {
    type: "notification",
    event,
    object: {
      id: paymentId,
      status,
      paid,
      metadata: {
        accountId,
        featureKey,
      },
    },
  };
}

function createTranscriptionRequest({
  audioBase64 = "UklGRiQAAABXQVZFZm10IBAAAAABAAEA",
  mimeType = "audio/webm",
  durationMs = 12000,
  language = "ru-RU",
  prompt = "focus reminder",
} = {}) {
  return {
    audioBase64,
    mimeType,
    durationMs,
    language,
    prompt,
  };
}

function createPushSubscription(endpoint) {
  return {
    endpoint,
    keys: {
      p256dh: "p256dh-key",
      auth: "auth-key",
    },
  };
}
