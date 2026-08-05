import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  createFocusSyncServer,
  createSyncDatabase,
} from "../server/sync-server.mjs";
import {
  createProductionQuoteSeed,
  getProductionQuoteSeedSummary,
  importProductionQuoteSeed,
  QUOTE_SEED_ID_PREFIX,
  QUOTE_SEED_PER_CATEGORY,
} from "../scripts/seed-production-quotes.mjs";
import {
  auditProductionQuotes,
  inspectRawQuoteCatalog,
} from "../scripts/audit-production-quotes.mjs";

test("production quote seed covers every default category at the publication threshold", () => {
  const seed = createProductionQuoteSeed();
  const summary = getProductionQuoteSeedSummary(seed);

  assert.equal(summary.quoteCount, 6300);
  assert.equal(summary.categoryCount, 14);
  assert.deepEqual(new Set(Object.values(summary.perCategory)), new Set([QUOTE_SEED_PER_CATEGORY]));
  assert.equal(new Set(seed.map(quote => quote.id)).size, seed.length);
  assert.ok(seed.every(quote => String(quote.id).startsWith(`${QUOTE_SEED_ID_PREFIX}-`)));
  assert.ok(seed.every(quote => quote.verificationStatus === "verified"));
  assert.ok(seed.every(quote => quote.rightsStatus === "permission_granted"));
});

test("production quote seed passes audit and powers categories and today APIs", async () => {
  const db = createSyncDatabase(":memory:");
  db.replaceQuoteCatalog({ quotes: createProductionQuoteSeed() });
  const normalizedCatalog = db.getQuoteCatalog();
  const audit = db.auditQuoteCatalogForProduction({ checkedAt: "2026-08-04T09:00:00.000Z" });
  let nextId = 0;
  const server = createFocusSyncServer({
    db,
    now: () => "2026-08-04T09:00:00.000Z",
    createId: () => `quote-seed-test-${nextId += 1}`,
  });
  const baseUrl = await listen(server);

  try {
    assert.equal(audit.totalQuotes, 6300);
    assert.equal(audit.blockedQuotes, 0);
    assert.deepEqual(audit.blockedQuoteIds, []);
    assert.deepEqual(audit.matchedRuleIds, []);

    const productionQuotes = normalizedCatalog.filter(isProductionEligibleLike);
    assert.equal(productionQuotes.length, 6300);
    const categoryCounts = countQuotesByCategory(productionQuotes);
    assert.equal(categoryCounts.size, 14);
    categoryCounts.forEach(count => assert.equal(count, QUOTE_SEED_PER_CATEGORY));

    const categoriesResponse = await fetch(`${baseUrl}/api/quotes/categories`);
    assert.equal(categoriesResponse.status, 200);
    const categoriesBody = await categoriesResponse.json();
    const activeCategories = categoriesBody.categories.filter(category => category.isActive);
    assert.equal(activeCategories.length, 14);
    activeCategories.forEach(category => {
      assert.equal(category.activeVerifiedCount, QUOTE_SEED_PER_CATEGORY);
      assert.equal(category.available, true);
    });

    const accountResponse = await fetch(`${baseUrl}/api/sync/accounts`, { method: "POST" });
    assert.equal(accountResponse.status, 201);
    const { accountId } = await accountResponse.json();

    const todayResponse = await fetch(`${baseUrl}/api/quotes/today?timezone=Europe%2FMoscow`, {
      headers: {
        "x-focus-account": accountId,
        "x-focus-device": "desktop",
      },
    });
    assert.equal(todayResponse.status, 200);
    const today = await todayResponse.json();
    assert.equal(today.localDate, "2026-08-04");
    assert.equal(today.timezone, "Europe/Moscow");
    assert.equal(today.quotes.length, 5);
    assert.deepEqual(today.quotes.map(quote => quote.position), [1, 2, 3, 4, 5]);
    assert.equal(new Set(today.quotes.map(quote => quote.id)).size, 5);
    today.quotes.forEach(quote => {
      assert.ok(String(quote.id).startsWith(`${QUOTE_SEED_ID_PREFIX}-`));
      assert.ok(quote.text);
      assert.ok(quote.authorName);
      assert.ok(quote.sourceTitle);
      assert.ok(quote.sourceReference);
      assert.ok(Array.isArray(quote.categoryCodes));
      assert.ok(quote.categoryCodes.length > 0);
      assert.equal(Object.hasOwn(quote, "profanityValidation"), false);
    });
  } finally {
    await close(server);
    db.close();
  }
});

test("production quote seed import replaces prior seed records and preserves manual quotes", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "focus-quote-seed-"));
  const dbPath = join(tempDir, "sync.json");

  try {
    const setupDb = createSyncDatabase(dbPath);
    setupDb.replaceQuoteCatalog({
      quotes: [
        createManualQuote(),
        {
          ...createProductionQuoteSeed({ perCategory: 1 })[0],
          id: `${QUOTE_SEED_ID_PREFIX}-stale-record`,
          text: "Stale seed record that should be replaced by import.",
          sourceReference: "Stale seed import test",
        },
      ],
    });
    setupDb.close();

    const result = importProductionQuoteSeed(dbPath, { perCategory: 2 });
    assert.equal(result.status, "imported");
    assert.equal(result.replaceSeed, true);
    assert.equal(result.preservedQuoteCount, 1);
    assert.equal(result.seedQuoteCount, 28);
    assert.equal(result.totalQuoteCount, 29);
    assert.equal(result.audit.blockedQuotes, 0);
    assert.equal(result.summary.quoteCount, 28);
    assert.equal(result.summary.categoryCount, 14);
    assert.deepEqual(new Set(Object.values(result.summary.perCategory)), new Set([2]));

    const importedDb = createSyncDatabase(dbPath);
    const importedCatalog = importedDb.getQuoteCatalog();
    importedDb.close();

    assert.equal(importedCatalog.length, 29);
    assert.ok(importedCatalog.some(quote => quote.id === "manual-import-quote"));
    assert.equal(importedCatalog.some(quote => quote.id === `${QUOTE_SEED_ID_PREFIX}-stale-record`), false);
    assert.equal(importedCatalog.filter(quote => String(quote.id).startsWith(`${QUOTE_SEED_ID_PREFIX}-`)).length, 28);

    const preserveResult = importProductionQuoteSeed(dbPath, { replaceSeed: false, perCategory: 2 });
    assert.equal(preserveResult.replaceSeed, false);
    assert.equal(preserveResult.preservedQuoteCount, 29);
    assert.equal(preserveResult.totalQuoteCount, 29);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("production quote audit reports category readiness without exposing quote text", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "focus-quote-audit-"));
  const dbPath = join(tempDir, "sync.json");

  try {
    const setupDb = createSyncDatabase(dbPath);
    setupDb.replaceQuoteCatalog({ quotes: createProductionQuoteSeed({ perCategory: 5 }) });
    setupDb.close();

    const result = auditProductionQuotes(dbPath, { checkedAt: "2026-08-04T10:00:00.000Z" });
    assert.equal(result.mode, "read_only");
    assert.equal(result.before.quoteCatalog, 70);
    assert.equal(result.audit.totalQuotes, 70);
    assert.equal(result.audit.blockedQuotes, 0);
    assert.equal(result.quality.checkedAt, "2026-08-04T10:00:00.000Z");
    assert.equal(result.quality.totalQuotes, 70);
    assert.equal(result.quality.eligibleQuotes, 70);
    assert.equal(result.quality.canServeToday, true);
    assert.equal(result.quality.removedByNormalization, 0);
    assert.equal(result.quality.rawIntegrity.quoteCount, 70);
    assert.equal(result.quality.rawIntegrity.duplicateIdCount, 0);
    assert.equal(result.quality.rawIntegrity.duplicateTextHashCount, 0);
    assert.equal(result.quality.rawIntegrity.incompleteQuoteCount, 0);
    assert.equal(result.quality.categoryReadiness.activeCategories, 14);
    assert.equal(result.quality.categoryReadiness.availableCategories, 0);
    assert.equal(result.quality.categoryReadiness.underfilledCategories.length, 14);
    assert.equal(result.quality.categoryReadiness.dailySetGaps.length, 0);
    assert.deepEqual(result.quality.categoryReadiness.unknownCategoryCodes, []);
    assert.ok(result.quality.warnings.includes("categories_below_minimum_catalog_size"));
    assert.equal(result.quality.warnings.includes("categories_below_daily_set_size"), false);
    result.quality.categoryReadiness.categoryCounts.forEach(category => {
      assert.equal(category.eligibleQuotes, 5);
      assert.equal(category.minimumCatalogSize, QUOTE_SEED_PER_CATEGORY);
      assert.equal(category.available, false);
      assert.equal(category.dailySetReady, true);
    });
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("production quote audit is read-only by default", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "focus-quote-readonly-audit-"));
  const dbPath = join(tempDir, "sync.json");
  const rawState = {
    quoteCatalog: [
      createManualQuote(),
      {
        ...createManualQuote(),
        id: "manual-import-quote-copy",
      },
      {
        id: "incomplete-quote",
        text: "Incomplete raw quote.",
        authorName: "Focus Editorial",
      },
    ],
  };

  try {
    writeFileSync(dbPath, `${JSON.stringify(rawState, null, 2)}\n`);
    const before = readFileSync(dbPath, "utf8");
    const result = auditProductionQuotes(dbPath, { checkedAt: "2026-08-04T10:30:00.000Z" });
    const after = readFileSync(dbPath, "utf8");

    assert.equal(result.mode, "read_only");
    assert.equal(result.before.quoteCatalog, 3);
    assert.equal(result.audit.totalQuotes, 1);
    assert.equal(result.quality.removedByNormalization, 2);
    assert.equal(result.quality.rawIntegrity.duplicateTextHashCount, 1);
    assert.equal(result.quality.rawIntegrity.incompleteQuoteCount, 1);
    assert.equal(after, before);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("production quote raw audit reports duplicates and incomplete records by safe identifiers", () => {
  const firstDuplicateText = {
    ...createManualQuote(),
    id: "duplicate-id",
    text: "Same raw quote text.",
  };
  const duplicateId = {
    ...createManualQuote(),
    id: "duplicate-id",
    text: "Different raw quote text.",
  };
  const duplicateText = {
    ...createManualQuote(),
    id: "duplicate-text",
    text: "Same raw quote text.",
  };
  const incomplete = {
    id: "incomplete-quote",
    text: "Incomplete raw quote.",
    authorName: "Focus Editorial",
  };

  const integrity = inspectRawQuoteCatalog([
    firstDuplicateText,
    duplicateId,
    duplicateText,
    incomplete,
  ]);

  assert.equal(integrity.quoteCount, 4);
  assert.equal(integrity.duplicateIdCount, 1);
  assert.deepEqual(integrity.duplicateIds, [{ id: "duplicate-id", count: 2 }]);
  assert.equal(integrity.duplicateTextHashCount, 1);
  assert.equal(integrity.duplicateTextHashes[0].count, 2);
  assert.deepEqual(integrity.duplicateTextHashes[0].sampleIds, ["duplicate-id", "duplicate-text"]);
  assert.equal(Object.hasOwn(integrity.duplicateTextHashes[0], "text"), false);
  assert.equal(integrity.incompleteQuoteCount, 1);
  assert.deepEqual(integrity.incompleteQuotes, [{
    index: 3,
    id: "incomplete-quote",
    fields: ["sourceTitle", "sourceReference", "categoryCodes"],
  }]);
  assert.deepEqual(integrity.truncated, {
    duplicateIds: false,
    duplicateTextHashes: false,
    incompleteQuotes: false,
    disallowedContentQuotes: false,
  });
});

function isProductionEligibleLike(quote) {
  return quote
    && quote.verificationStatus === "verified"
    && quote.isActive === true
    && quote.contentValidation === "passed"
    && quote.profanityValidation?.status === "passed"
    && quote.profanityValidation?.code === "profanity_not_detected"
    && quote.rightsStatus !== "review_required"
    && quote.displayLanguage === "ru"
    && Array.isArray(quote.categoryCodes)
    && quote.categoryCodes.length > 0;
}

function countQuotesByCategory(quotes) {
  const counts = new Map();
  quotes.forEach(quote => {
    quote.categoryCodes.forEach(code => {
      counts.set(code, (counts.get(code) || 0) + 1);
    });
  });
  return counts;
}

function createManualQuote() {
  return {
    id: "manual-import-quote",
    text: "Manual catalog quote remains available after seed import.",
    authorName: "Focus Editorial",
    sourceTitle: "Manual seed import test",
    sourceType: "other",
    sourceReference: "Manual record",
    publicationYear: 2026,
    originalLanguage: "ru",
    displayLanguage: "ru",
    verificationStatus: "verified",
    rightsStatus: "permission_granted",
    rightsNote: "Manual test quote.",
    isActive: true,
    verifiedBy: "Focus Editorial",
    verifiedAt: "2026-08-04T00:00:00.000Z",
    createdAt: "2026-08-04T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
    categoryCodes: ["life_wisdom"],
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
  return new Promise(resolve => server.close(resolve));
}
