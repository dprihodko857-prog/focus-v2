import http from "node:http";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  DEFAULT_INTERESTING_TODAY_CATALOG,
  INTERESTING_TODAY_CATALOG_VERSION,
  createInterestingTodayCatalogReport,
  formatInterestingTodayRecordForApi,
  selectInterestingTodayRecords,
} from "../server/interesting-today-catalog.mjs";

const CONTROL_DATES = [
  "2028-01-10",
  "2028-02-18",
  "2028-02-29",
  "2028-04-10",
  "2028-09-24",
  "2028-12-19",
  "2028-12-26",
];

const PORT = Number(process.env.FOCUS_INTERESTING_UI_SMOKE_PORT || 4198);
const ROOT = resolve("public");
const OUTPUT_DIR = "output/playwright";
const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
};

function findPlaywrightPackage() {
  const cacheRoot = join(process.env.LOCALAPPDATA || "", "npm-cache", "_npx");
  if (!existsSync(cacheRoot)) {
    throw new Error(`npx cache not found: ${cacheRoot}`);
  }

  const candidates = readdirSync(cacheRoot)
    .map(name => join(cacheRoot, name, "node_modules", "playwright", "index.mjs"))
    .filter(path => existsSync(path))
    .sort((first, second) => statSync(second).mtimeMs - statSync(first).mtimeMs);

  if (!candidates.length) {
    throw new Error("Playwright package not found in npx cache");
  }

  return candidates[0];
}

function createStaticServer() {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://127.0.0.1:${PORT}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";

    const filePath = normalize(join(ROOT, pathname));
    if (!filePath.startsWith(ROOT)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    try {
      const body = await readFile(filePath);
      response.writeHead(200, {
        "content-type": CONTENT_TYPES[extname(filePath)] || "application/octet-stream",
        "cache-control": "no-store",
      });
      response.end(body);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });
}

function listen(server) {
  return new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(PORT, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
}

function closeServer(server) {
  return new Promise(resolveClose => server.close(resolveClose));
}

function isoMidnight(localDate) {
  return `${localDate}T00:00:00.000Z`;
}

function createTodayPayload(localDate) {
  const selected = selectInterestingTodayRecords({
    catalog: DEFAULT_INTERESTING_TODAY_CATALOG,
    countryCode: "RU",
    language: "ru",
    localDate,
  });
  const events = selected.events.map((record, index) => formatInterestingTodayRecordForApi(record, index + 1)).filter(Boolean);
  const people = selected.people.map((record, index) => formatInterestingTodayRecordForApi(record, index + 1)).filter(Boolean);

  return {
    localDate,
    timezone: "Europe/Moscow",
    countryCode: "RU",
    language: "ru",
    catalogVersion: INTERESTING_TODAY_CATALOG_VERSION,
    validFromUtc: isoMidnight(localDate),
    validUntilUtc: isoMidnight("2028-12-31"),
    generationReason: "ui_smoke",
    compact: { events: 2, people: 2 },
    limits: { events: 5, people: 6 },
    availableEvents: selected.availableEvents,
    availablePeople: selected.availablePeople,
    preferences: {
      countryCode: "RU",
      language: "ru",
      showEvents: true,
      showPeople: true,
    },
    events,
    people,
  };
}

function createVersionPayload() {
  return {
    version: INTERESTING_TODAY_CATALOG_VERSION,
    countryCode: "RU",
    language: "ru",
    limits: { events: 5, people: 6 },
    report: createInterestingTodayCatalogReport(DEFAULT_INTERESTING_TODAY_CATALOG, {
      checkedAt: new Date().toISOString(),
    }),
    checkedAt: new Date().toISOString(),
  };
}

function findRecord(recordType, recordId, currentPayload) {
  const records = recordType === "events" ? currentPayload.events : currentPayload.people;
  return records.find(record => record.id === recordId) || null;
}

function jsonResponse(payload, status = 200) {
  return {
    status,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(payload),
  };
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const server = createStaticServer();
  await listen(server);

  const { chromium } = await import(pathToFileURL(findPlaywrightPackage()).href);
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.FOCUS_SMOKE_BROWSER_CHANNEL || "chrome",
  });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    serviceWorkers: "block",
  });
  await context.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  const page = await context.newPage();
  const diagnostics = {
    console: [],
    pageErrors: [],
    failedRequests: [],
  };
  page.on("console", message => {
    if (["error", "warning"].includes(message.type())) {
      diagnostics.console.push({ type: message.type(), text: message.text() });
    }
  });
  page.on("pageerror", error => diagnostics.pageErrors.push(error.message));
  page.on("requestfailed", request => {
    diagnostics.failedRequests.push({
      url: request.url(),
      failure: request.failure()?.errorText || "",
    });
  });

  let currentDate = CONTROL_DATES[0];
  let currentPayload = createTodayPayload(currentDate);

  await page.route("**/api/**", route => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;

    if (pathname === "/api/sync/accounts") {
      return route.fulfill(jsonResponse({
        accountId: "ui-smoke-interesting-today",
        createdAt: new Date().toISOString(),
      }));
    }

    if (pathname === "/api/interesting-today/version") {
      return route.fulfill(jsonResponse(createVersionPayload()));
    }

    if (pathname === "/api/interesting-today/preferences") {
      return route.fulfill(jsonResponse({
        accountId: "ui-smoke-interesting-today",
        preferences: currentPayload.preferences,
        checkedAt: new Date().toISOString(),
      }));
    }

    if (pathname === "/api/interesting-today/today") {
      currentPayload = createTodayPayload(currentDate);
      return route.fulfill(jsonResponse(currentPayload));
    }

    const detailMatch = pathname.match(/^\/api\/interesting-today\/(events|people)\/([^/]+)$/);
    if (detailMatch) {
      const id = decodeURIComponent(detailMatch[2]);
      const record = findRecord(detailMatch[1], id, currentPayload);
      return route.fulfill(jsonResponse(record ? { record, checkedAt: new Date().toISOString() } : { error: "not_found" }, record ? 200 : 404));
    }

    return route.fulfill(jsonResponse({ ok: true }));
  });

  const results = [];
  for (const localDate of CONTROL_DATES) {
    currentDate = localDate;
    currentPayload = createTodayPayload(localDate);
    await page.goto(`http://127.0.0.1:${PORT}/?interestingSmokeDate=${localDate}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.locator("#interestingToday").waitFor({ timeout: 20000 });
    await page.locator("#interestingTodayBody .interesting-item").first().waitFor({ timeout: 20000 });

    const compact = await page.locator("#interestingToday").evaluate(section => ({
      text: section.innerText,
      itemCount: section.querySelectorAll(".interesting-item").length,
      moreButtonText: section.querySelector("[data-interesting-full-list]")?.textContent?.trim() || "",
      firstEventTitles: [...section.querySelectorAll(".interesting-panel--event .interesting-item strong")]
        .slice(0, 2)
        .map(item => item.textContent?.trim() || ""),
      firstPeopleTitles: [...section.querySelectorAll(".interesting-panel--person .interesting-item strong")]
        .slice(0, 2)
        .map(item => item.textContent?.trim() || ""),
      eventMeta: [...section.querySelectorAll(".interesting-panel--event .interesting-item__meta")]
        .slice(0, 2)
        .map(item => item.textContent?.trim() || ""),
      peopleMeta: [...section.querySelectorAll(".interesting-panel--person .interesting-item__meta")]
        .slice(0, 2)
        .map(item => item.textContent?.trim() || ""),
    }));

    await page.locator("[data-interesting-full-list]").first().click({ timeout: 15000 });
    await page.locator("#interestingTodayModal:not([hidden])").waitFor({ timeout: 15000 });
    await page.locator("#interestingTodayFullList [data-interesting-record]").first().waitFor({ timeout: 15000 });

    const modal = await page.locator("#interestingTodayModal").evaluate(dialog => ({
      status: dialog.querySelector("#interestingTodayModalStatus")?.textContent?.trim() || "",
      eventRows: dialog.querySelectorAll(".interesting-modal-section:first-child [data-interesting-record='event']").length,
      personRows: dialog.querySelectorAll(".interesting-modal-section:nth-child(2) [data-interesting-record='person']").length,
      text: dialog.innerText,
      canScroll: (() => {
        const body = dialog.querySelector(".modal-body");
        return body ? body.scrollHeight > body.clientHeight : false;
      })(),
    }));

    await page.locator("#interestingTodayFullList [data-interesting-record]").first().click({ timeout: 15000 });
    await page.locator("#interestingTodayDetailModal:not([hidden])").waitFor({ timeout: 15000 });
    const detail = await page.locator("#interestingTodayDetailModal").evaluate(dialog => ({
      title: dialog.querySelector("#interestingTodayDetailTitle")?.textContent?.trim() || "",
      sourceLinks: dialog.querySelectorAll("a[href^='http']").length,
    }));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);

    const eventTopRu = currentPayload.events.slice(0, 2).filter(record => record.countryCodes.includes("RU")).length;
    const peopleTopRu = currentPayload.people.slice(0, 2).filter(record => record.countryCodes.includes("RU")).length;
    const ok = compact.moreButtonText === "Показать ещё" &&
      compact.itemCount === 4 &&
      modal.eventRows === currentPayload.events.length &&
      modal.personRows === currentPayload.people.length &&
      detail.sourceLinks > 0 &&
      eventTopRu >= 2 &&
      peopleTopRu >= 2;

    results.push({
      localDate,
      ok,
      compact: {
        itemCount: compact.itemCount,
        moreButtonText: compact.moreButtonText,
        firstEventTitles: compact.firstEventTitles,
        firstPeopleTitles: compact.firstPeopleTitles,
        eventMeta: compact.eventMeta,
        peopleMeta: compact.peopleMeta,
      },
      modal: {
        eventRows: modal.eventRows,
        personRows: modal.personRows,
        status: modal.status,
        canScroll: modal.canScroll,
      },
      detail,
      api: {
        availableEvents: currentPayload.availableEvents,
        availablePeople: currentPayload.availablePeople,
        returnedEvents: currentPayload.events.length,
        returnedPeople: currentPayload.people.length,
        eventTopRu,
        peopleTopRu,
      },
    });
  }

  await page.setViewportSize({ width: 390, height: 640 });
  currentDate = "2028-09-24";
  currentPayload = createTodayPayload(currentDate);
  await page.goto(`http://127.0.0.1:${PORT}/?interestingSmokeDate=${currentDate}&viewport=mobile`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.locator("#interestingTodayBody .interesting-item").first().waitFor({ timeout: 20000 });
  await page.locator("[data-interesting-full-list]").first().click({ timeout: 15000 });
  await page.locator("#interestingTodayModal:not([hidden])").waitFor({ timeout: 15000 });
  const mobileScroll = await page.locator("#interestingTodayModal").evaluate(dialog => {
    const body = dialog.querySelector(".modal-body");
    if (!body) {
      return { canScroll: false, before: 0, after: 0, maxScroll: 0 };
    }
    const maxScroll = Math.max(0, body.scrollHeight - body.clientHeight);
    const before = body.scrollTop;
    body.scrollTop = maxScroll;
    body.dispatchEvent(new Event("scroll", { bubbles: true }));
    const after = body.scrollTop;
    return {
      canScroll: maxScroll > 0,
      before,
      after,
      maxScroll,
      scrolled: after > before,
    };
  });
  await page.screenshot({ path: `${OUTPUT_DIR}/interesting-local-ui-smoke-mobile-scroll.png`, fullPage: true });
  await page.screenshot({ path: `${OUTPUT_DIR}/interesting-local-ui-smoke-final.png`, fullPage: true });
  await browser.close();
  await closeServer(server);

  const result = {
    ok: results.every(item => item.ok) &&
      mobileScroll.canScroll &&
      mobileScroll.scrolled &&
      diagnostics.pageErrors.length === 0 &&
      diagnostics.failedRequests.filter(item => !/favicon/i.test(item.url)).length === 0,
    version: INTERESTING_TODAY_CATALOG_VERSION,
    dates: results,
    mobileScroll,
    diagnostics: {
      ...diagnostics,
      failedRequests: diagnostics.failedRequests.filter(item => !/favicon/i.test(item.url)),
    },
  };
  writeFileSync(`${OUTPUT_DIR}/interesting-local-ui-smoke.json`, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  const fallback = {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : "",
  };
  writeFileSync(`${OUTPUT_DIR}/interesting-local-ui-smoke.json`, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
  console.error(JSON.stringify(fallback, null, 2));
  process.exitCode = 1;
  setTimeout(() => process.exit(1), 0);
});
