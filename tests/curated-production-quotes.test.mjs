import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  createFocusSyncServer,
  createSyncDatabase,
} from "../server/sync-server.mjs";
import {
  auditProductionQuotes,
  createProductionQuoteQualityReport,
  inspectRawQuoteCatalog,
} from "../scripts/audit-production-quotes.mjs";
import {
  createCuratedQuoteCategoryOverrides,
  createCuratedProductionQuotes,
  getCuratedProductionQuoteSummary,
  importCuratedProductionQuotes,
  CURATED_QUOTE_ID_PREFIX,
  CURATED_QUOTE_PREVIEW_CATEGORY_MINIMUM,
} from "../scripts/curated-production-quotes.mjs";
import {
  createProductionQuoteSeed,
  QUOTE_SEED_ID_PREFIX,
} from "../scripts/seed-production-quotes.mjs";

test("curated production quotes contain only clean quote text and real authors", () => {
  const quotes = createCuratedProductionQuotes();
  const summary = getCuratedProductionQuoteSummary(quotes);
  const rawIntegrity = inspectRawQuoteCatalog(quotes);

  assert.equal(quotes.length, 44);
  assert.equal(summary.quoteCount, 44);
  assert.ok(summary.authorCount >= 7);
  assert.ok(summary.sourceCount >= 10);
  assert.equal(new Set(quotes.map(quote => quote.id)).size, quotes.length);
  assert.ok(quotes.every(quote => String(quote.id).startsWith(`${CURATED_QUOTE_ID_PREFIX}-`)));
  assert.ok(quotes.every(quote => !String(quote.id).startsWith(`${QUOTE_SEED_ID_PREFIX}-`)));
  assert.ok(quotes.every(quote => quote.text && !quote.text.startsWith("В теме ")));
  assert.ok(quotes.every(quote => quote.authorName && !/^(Редакция Focus|Focus Editorial)$/u.test(quote.authorName)));
  assert.ok(quotes.every(quote => quote.sourceTitle && quote.sourceReference && quote.sourceUrl));
  assert.ok(quotes.every(quote => quote.verificationStatus === "verified"));
  assert.ok(quotes.every(quote => quote.rightsStatus === "public_domain"));
  assert.ok(quotes.every(quote => Array.isArray(quote.categoryCodes) && quote.categoryCodes.length > 0));
  assert.equal(rawIntegrity.disallowedContentQuoteCount, 0);
});

test("quote quality audit flags generated Focus editorial records", () => {
  const generated = createProductionQuoteSeed({ perCategory: 1 });
  const rawIntegrity = inspectRawQuoteCatalog(generated);
  const db = createSyncDatabase(":memory:");

  try {
    db.replaceQuoteCatalog({ quotes: generated });
    const report = createProductionQuoteQualityReport({
      audit: db.auditQuoteCatalogForProduction({ checkedAt: "2026-08-05T08:00:00.000Z" }),
      catalog: db.getQuoteCatalog(),
      categories: db.getQuoteCategories(),
      checkedAt: "2026-08-05T08:00:00.000Z",
      rawIntegrity,
    });

    assert.equal(rawIntegrity.disallowedContentQuoteCount, generated.length);
    assert.ok(rawIntegrity.disallowedContentQuotes.every(quote => quote.reasons.includes("generated_focus_seed_id")));
    assert.ok(report.warnings.includes("raw_disallowed_quote_content_present"));
  } finally {
    db.close();
  }
});

test("curated quote import replaces generated seed records and preserves manual quotes", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "focus-curated-quotes-"));
  const dbPath = join(tempDir, "sync.json");

  try {
    const setupDb = createSyncDatabase(dbPath);
    setupDb.replaceQuoteCatalog({
      quotes: [
        createManualQuote(),
        ...createProductionQuoteSeed({ perCategory: 1 }),
      ],
    });
    setupDb.close();

    const result = importCuratedProductionQuotes(dbPath);
    assert.equal(result.status, "imported");
    assert.equal(result.replaceGenerated, true);
    assert.equal(result.preservedQuoteCount, 1);
    assert.equal(result.removedGeneratedQuoteCount, 14);
    assert.equal(result.curatedQuoteCount, 44);
    assert.equal(result.importedCuratedQuoteCount, 44);
    assert.equal(result.totalQuoteCount, 45);
    assert.equal(result.audit.blockedQuotes, 0);

    const importedAudit = auditProductionQuotes(dbPath, { checkedAt: "2026-08-05T08:30:00.000Z" });
    assert.equal(importedAudit.quality.rawIntegrity.disallowedContentQuoteCount, 0);
    assert.equal(importedAudit.quality.canServeToday, true);
    assert.equal(importedAudit.quality.warnings.includes("raw_disallowed_quote_content_present"), false);

    const importedDb = createSyncDatabase(dbPath);
    const importedCatalog = importedDb.getQuoteCatalog();
    importedDb.close();

    assert.ok(importedCatalog.some(quote => quote.id === "manual-curated-import-quote"));
    assert.equal(importedCatalog.some(quote => String(quote.id).startsWith(`${QUOTE_SEED_ID_PREFIX}-`)), false);
    assert.equal(importedCatalog.filter(quote => String(quote.id).startsWith(`${CURATED_QUOTE_ID_PREFIX}-`)).length, 44);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("curated quote import can lower category thresholds for local preview", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "focus-curated-preview-quotes-"));
  const dbPath = join(tempDir, "sync.json");

  try {
    const result = importCuratedProductionQuotes(dbPath, {
      categoryMinimumCatalogSize: CURATED_QUOTE_PREVIEW_CATEGORY_MINIMUM,
    });
    assert.equal(result.status, "imported");
    assert.equal(result.categoryMinimumCatalogSize, CURATED_QUOTE_PREVIEW_CATEGORY_MINIMUM);

    const db = createSyncDatabase(dbPath);
    let nextId = 0;
    const server = createFocusSyncServer({
      db,
      now: () => "2026-08-05T09:00:00.000Z",
      createId: () => `curated-preview-test-${nextId += 1}`,
    });
    const baseUrl = await listen(server);

    try {
      const categoriesResponse = await fetch(`${baseUrl}/api/quotes/categories`);
      assert.equal(categoriesResponse.status, 200);
      const categoriesBody = await categoriesResponse.json();
      const activeCategories = categoriesBody.categories.filter(category => category.isActive);

      assert.equal(activeCategories.length, 14);
      activeCategories.forEach(category => {
        assert.equal(category.minimumCatalogSize, CURATED_QUOTE_PREVIEW_CATEGORY_MINIMUM);
        assert.equal(category.activeVerifiedCount >= CURATED_QUOTE_PREVIEW_CATEGORY_MINIMUM, true);
        assert.equal(category.available, true);
      });
    } finally {
      await close(server);
      db.close();
    }
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("curated quotes power the today API without Focus editorial text", async () => {
  const db = createSyncDatabase(":memory:");
  db.replaceQuoteCatalog({ quotes: createCuratedProductionQuotes() });
  let nextId = 0;
  const server = createFocusSyncServer({
    db,
    now: () => "2026-08-05T09:00:00.000Z",
    createId: () => `curated-quote-test-${nextId += 1}`,
  });
  const baseUrl = await listen(server);

  try {
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

    assert.equal(today.localDate, "2026-08-05");
    assert.equal(today.quotes.length, 5);
    assert.equal(new Set(today.quotes.map(quote => quote.id)).size, 5);
    today.quotes.forEach(quote => {
      assert.ok(quote.text);
      assert.ok(quote.authorName);
      assert.ok(!quote.text.startsWith("В теме "));
      assert.doesNotMatch(quote.authorName, /Редакция Focus|Focus Editorial/u);
      assert.equal(Object.hasOwn(quote, "profanityValidation"), false);
    });
  } finally {
    await close(server);
    db.close();
  }
});

test("curated category overrides preserve category metadata", () => {
  const categories = createCuratedQuoteCategoryOverrides([
    {
      code: "life_wisdom",
      label: "Жизнь и мудрость",
      description: "Тестовая категория",
      minimumCatalogSize: 450,
      isActive: true,
    },
  ], { minimumCatalogSize: CURATED_QUOTE_PREVIEW_CATEGORY_MINIMUM });

  assert.deepEqual(categories, [
    {
      code: "life_wisdom",
      label: "Жизнь и мудрость",
      description: "Тестовая категория",
      minimumCatalogSize: CURATED_QUOTE_PREVIEW_CATEGORY_MINIMUM,
      isActive: true,
    },
  ]);
});

function createManualQuote() {
  return {
    id: "manual-curated-import-quote",
    text: "Ручная цитата сохраняется при curated-импорте.",
    authorName: "Тестовый автор",
    sourceTitle: "Тестовый источник",
    sourceType: "other",
    sourceReference: "ручная запись",
    publicationYear: 1900,
    originalLanguage: "ru",
    displayLanguage: "ru",
    verificationStatus: "verified",
    rightsStatus: "public_domain",
    rightsNote: "Тестовая запись.",
    isActive: true,
    verifiedBy: "test",
    verifiedAt: "2026-08-05T00:00:00.000Z",
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
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
