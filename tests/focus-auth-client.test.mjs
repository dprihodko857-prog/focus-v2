import assert from "node:assert/strict";
import { test } from "node:test";

import { createFocusAuthClient } from "../public/js/auth.js";

test("auth client loads session and starts backend login", async () => {
  const calls = [];
  const location = {
    origin: "https://focus-v2.dmnao83.ru",
    pathname: "/",
    search: "",
    hash: "",
    href: "https://focus-v2.dmnao83.ru/",
  };
  const client = createFocusAuthClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      return jsonResponse({
        configured: true,
        authenticated: true,
        accountId: "orbit:abc",
        user: { name: "Григорий", email: "user@example.test" },
      });
    },
    location,
  });

  const session = await client.getSession();
  assert.equal(session.status, "ok");
  assert.equal(session.authenticated, true);
  assert.equal(session.accountId, "orbit:abc");
  assert.equal(calls[0].url, "/api/auth/session");

  client.login("/settings?tab=sync");
  assert.equal(location.href, "/api/auth/login?returnTo=%2Fsettings%3Ftab%3Dsync");
});

test("auth client requests backend logout", async () => {
  const calls = [];
  const client = createFocusAuthClient({
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      return jsonResponse({ authenticated: false });
    },
  });

  const result = await client.logout();

  assert.deepEqual(result, { status: "ok", authenticated: false });
  assert.equal(calls[0].url, "/api/auth/logout");
  assert.equal(calls[0].options.method, "POST");
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
