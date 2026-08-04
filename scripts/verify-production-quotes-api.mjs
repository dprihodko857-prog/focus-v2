import { readFileSync } from "node:fs";
import { createSyncDatabase } from "../server/sync-server.mjs";

const dbPath = process.argv[2] || "/opt/focus-v2/data/focus-sync.json";
const apiBaseUrl = process.argv[3] || "http://127.0.0.1:4178";
const state = JSON.parse(readFileSync(dbPath, "utf8"));
const accountId = Object.keys(state.accounts || {})[0] || "";

if (!accountId) {
  console.log(JSON.stringify({ status: "skipped", reason: "no_accounts" }, null, 2));
  process.exit(0);
}

const db = createSyncDatabase(dbPath);
const eligibleQuoteIds = new Set(
  db.getQuoteCatalog()
    .filter(quote => quote.contentValidation === "passed"
      && quote.profanityValidation?.status === "passed"
      && quote.profanityValidation?.code === "profanity_not_detected")
    .map(quote => quote.id),
);

const response = await fetch(`${apiBaseUrl}/api/quotes/today?timezone=Europe%2FMoscow`, {
  headers: {
    "x-focus-account": accountId,
    "x-focus-device": "production-quote-api-check",
  },
});
const body = await response.json().catch(() => ({}));
const quotes = Array.isArray(body.quotes) ? body.quotes : [];
const invalidRecordCount = quotes.filter(quote => !eligibleQuoteIds.has(quote.id)).length;

console.log(JSON.stringify({
  status: response.ok || response.status === 503 ? "checked" : "failed",
  responseStatus: response.status,
  error: typeof body.error === "string" ? body.error : null,
  quoteCount: quotes.length,
  invalidRecordCount,
}, null, 2));

if (!(response.ok || response.status === 503) || invalidRecordCount > 0) {
  process.exit(1);
}
