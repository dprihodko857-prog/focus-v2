import { readFileSync } from "node:fs";
import { createSyncDatabase } from "../server/sync-server.mjs";

const dbPath = process.argv[2] || "/opt/focus-v2/data/focus-sync.json";
const state = JSON.parse(readFileSync(dbPath, "utf8"));
const before = {
  quoteCatalog: Array.isArray(state.quoteCatalog) ? state.quoteCatalog.length : 0,
  dailyQuoteSets: state.dailyQuoteSets && typeof state.dailyQuoteSets === "object"
    ? Object.keys(state.dailyQuoteSets).length
    : 0,
  dailyQuoteSetItems: state.dailyQuoteSetItems && typeof state.dailyQuoteSetItems === "object"
    ? Object.keys(state.dailyQuoteSetItems).length
    : 0,
};
const db = createSyncDatabase(dbPath);
const audit = db.auditQuoteCatalogForProduction({ checkedAt: new Date().toISOString() });
db.close();

console.log(JSON.stringify({ before, audit }, null, 2));
