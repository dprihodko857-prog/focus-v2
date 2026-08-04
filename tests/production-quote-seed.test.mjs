import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createFocusSyncServer,
  createSyncDatabase,
} from "../server/sync-server.mjs";
import {
  createProductionQuoteSeed,
  getProductionQuoteSeedSummary,
  QUOTE_SEED_ID_PREFIX,
  QUOTE_SEED_PER_CATEGORY,
} from "../scripts/seed-production-quotes.mjs";

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
