import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { createSyncDatabase } from "../server/sync-server.mjs";

export const DEFAULT_PRODUCTION_QUOTE_DB_PATH = "/opt/focus-v2/data/focus-sync.json";

const QUOTES_PER_DAY = 5;
const QUOTE_LANGUAGE = "ru";
const QUOTE_VERIFICATION_STATUS = "verified";
const QUOTE_CONTENT_VALIDATION_PASSED = "passed";
const QUOTE_PROFANITY_NOT_DETECTED = "profanity_not_detected";
const QUOTE_RIGHTS_BLOCKED_STATUS = "review_required";
const DUPLICATE_GROUP_LIMIT = 20;
const SAMPLE_ID_LIMIT = 5;
const REQUIRED_RAW_QUOTE_FIELDS = ["id", "text", "authorName", "sourceTitle", "sourceReference"];

export function auditProductionQuotes(
  dbPath = DEFAULT_PRODUCTION_QUOTE_DB_PATH,
  { checkedAt = new Date().toISOString(), readOnly = true } = {},
) {
  if (!dbPath) {
    throw new Error("dbPath is required.");
  }

  const state = readQuoteDatabaseState(dbPath);
  const before = summarizeStoredQuoteState(state);
  const rawIntegrity = inspectRawQuoteCatalog(state.quoteCatalog);
  const db = createSyncDatabase(readOnly ? ":memory:" : dbPath);

  try {
    if (readOnly) {
      db.replaceQuoteCatalog({
        quotes: state.quoteCatalog,
        categories: state.quoteCategories,
      });
    }

    const audit = db.auditQuoteCatalogForProduction({ checkedAt });
    const catalog = db.getQuoteCatalog();
    const categories = db.getQuoteCategories();
    return {
      mode: readOnly ? "read_only" : "write_normalized",
      before,
      audit,
      quality: createProductionQuoteQualityReport({
        audit,
        catalog,
        categories,
        checkedAt,
        rawIntegrity,
      }),
    };
  } finally {
    db.close();
  }
}

export function createProductionQuoteQualityReport({
  audit = {},
  catalog = [],
  categories = [],
  checkedAt = new Date().toISOString(),
  rawIntegrity = inspectRawQuoteCatalog(catalog),
} = {}) {
  const normalizedCatalog = Array.isArray(catalog) ? catalog : [];
  const categoryList = Array.isArray(categories) ? categories : [];
  const eligibleQuotes = normalizedCatalog.filter(isProductionEligibleQuote);
  const categoryCounts = createCategoryReadiness(categoryList, eligibleQuotes);
  const activeCategoryCounts = categoryCounts.filter(category => category.isActive);
  const underfilledCategories = activeCategoryCounts
    .filter(category => category.eligibleQuotes < category.minimumCatalogSize)
    .map(({ code, eligibleQuotes: count, minimumCatalogSize }) => ({ code, eligibleQuotes: count, minimumCatalogSize }));
  const dailySetGaps = activeCategoryCounts
    .filter(category => category.eligibleQuotes < QUOTES_PER_DAY)
    .map(({ code, eligibleQuotes: count }) => ({ code, eligibleQuotes: count, requiredQuotes: QUOTES_PER_DAY }));
  const unknownCategoryCodes = getUnknownCategoryCodes(normalizedCatalog, categoryList);
  const warnings = createQualityWarnings({
    audit,
    dailySetGaps,
    eligibleQuoteCount: eligibleQuotes.length,
    rawIntegrity,
    underfilledCategories,
    unknownCategoryCodes,
  });

  return {
    checkedAt,
    totalQuotes: normalizedCatalog.length,
    eligibleQuotes: eligibleQuotes.length,
    canServeToday: eligibleQuotes.length >= QUOTES_PER_DAY,
    removedByNormalization: Math.max(0, rawIntegrity.quoteCount - normalizedCatalog.length),
    statusCounts: {
      active: normalizedCatalog.filter(quote => quote?.isActive === true).length,
      inactive: normalizedCatalog.filter(quote => quote?.isActive !== true).length,
      verified: normalizedCatalog.filter(quote => quote?.verificationStatus === QUOTE_VERIFICATION_STATUS).length,
      rejected: normalizedCatalog.filter(quote => quote?.verificationStatus === "rejected").length,
      contentPassed: normalizedCatalog.filter(quote => quote?.contentValidation === QUOTE_CONTENT_VALIDATION_PASSED).length,
      profanityBlocked: Number(audit.blockedQuotes) || 0,
      rightsReviewRequired: normalizedCatalog.filter(quote => quote?.rightsStatus === QUOTE_RIGHTS_BLOCKED_STATUS).length,
    },
    rawIntegrity,
    categoryReadiness: {
      activeCategories: activeCategoryCounts.length,
      availableCategories: activeCategoryCounts.filter(category => category.available).length,
      underfilledCategories,
      dailySetGaps,
      unknownCategoryCodes,
      categoryCounts,
    },
    warnings,
  };
}

export function inspectRawQuoteCatalog(quotes = []) {
  const rawQuotes = Array.isArray(quotes) ? quotes : [];
  const idGroups = new Map();
  const textHashGroups = new Map();
  const incompleteQuotes = [];

  rawQuotes.forEach((quote, index) => {
    const id = sanitizeReportValue(quote?.id);
    if (id) {
      idGroups.set(id, (idGroups.get(id) || 0) + 1);
    }

    const normalizedText = normalizeQuoteTextForAudit(quote?.text);
    if (normalizedText) {
      const textHash = createAuditHash(normalizedText);
      const group = textHashGroups.get(textHash) || { textHash, count: 0, sampleIds: [] };
      group.count += 1;
      if (group.sampleIds.length < SAMPLE_ID_LIMIT) {
        group.sampleIds.push(id || `index:${index}`);
      }
      textHashGroups.set(textHash, group);
    }

    const missingFields = getMissingRawQuoteFields(quote);
    if (missingFields.length > 0) {
      incompleteQuotes.push({
        index,
        id: id || null,
        fields: missingFields,
      });
    }
  });

  const duplicateIds = [...idGroups.entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]) => ({ id, count }));
  const duplicateTextHashes = [...textHashGroups.values()]
    .filter(group => group.count > 1);

  return {
    quoteCount: rawQuotes.length,
    duplicateIdCount: duplicateIds.length,
    duplicateIds: duplicateIds.slice(0, DUPLICATE_GROUP_LIMIT),
    duplicateTextHashCount: duplicateTextHashes.length,
    duplicateTextHashes: duplicateTextHashes.slice(0, DUPLICATE_GROUP_LIMIT),
    incompleteQuoteCount: incompleteQuotes.length,
    incompleteQuotes: incompleteQuotes.slice(0, DUPLICATE_GROUP_LIMIT),
    truncated: {
      duplicateIds: duplicateIds.length > DUPLICATE_GROUP_LIMIT,
      duplicateTextHashes: duplicateTextHashes.length > DUPLICATE_GROUP_LIMIT,
      incompleteQuotes: incompleteQuotes.length > DUPLICATE_GROUP_LIMIT,
    },
  };
}

function readQuoteDatabaseState(dbPath) {
  return JSON.parse(readFileSync(dbPath, "utf8"));
}

function summarizeStoredQuoteState(state) {
  return {
    quoteCatalog: Array.isArray(state.quoteCatalog) ? state.quoteCatalog.length : 0,
    dailyQuoteSets: state.dailyQuoteSets && typeof state.dailyQuoteSets === "object"
      ? Object.keys(state.dailyQuoteSets).length
      : 0,
    dailyQuoteSetItems: state.dailyQuoteSetItems && typeof state.dailyQuoteSetItems === "object"
      ? Object.keys(state.dailyQuoteSetItems).length
      : 0,
  };
}

function createCategoryReadiness(categories, eligibleQuotes) {
  return categories.map(category => {
    const eligibleCount = eligibleQuotes.filter(quote => quote.categoryCodes.includes(category.code)).length;
    const minimumCatalogSize = Math.max(0, Math.floor(Number(category.minimumCatalogSize) || 0));
    return {
      code: category.code,
      titleRu: category.titleRu,
      isActive: category.isActive !== false,
      minimumCatalogSize,
      eligibleQuotes: eligibleCount,
      available: eligibleCount >= minimumCatalogSize,
      dailySetReady: eligibleCount >= QUOTES_PER_DAY,
    };
  });
}

function createQualityWarnings({
  audit,
  dailySetGaps,
  eligibleQuoteCount,
  rawIntegrity,
  underfilledCategories,
  unknownCategoryCodes,
}) {
  return [
    eligibleQuoteCount < QUOTES_PER_DAY ? "not_enough_eligible_quotes_for_today" : "",
    (Number(audit.blockedQuotes) || 0) > 0 ? "profanity_blocked_quotes_present" : "",
    rawIntegrity.duplicateIdCount > 0 ? "raw_duplicate_quote_ids_present" : "",
    rawIntegrity.duplicateTextHashCount > 0 ? "raw_duplicate_quote_texts_present" : "",
    rawIntegrity.incompleteQuoteCount > 0 ? "raw_incomplete_quotes_present" : "",
    underfilledCategories.length > 0 ? "categories_below_minimum_catalog_size" : "",
    dailySetGaps.length > 0 ? "categories_below_daily_set_size" : "",
    unknownCategoryCodes.length > 0 ? "unknown_category_codes_present" : "",
  ].filter(Boolean);
}

function getUnknownCategoryCodes(catalog, categories) {
  const knownCodes = new Set(categories.map(category => category.code).filter(Boolean));
  const unknownCodes = new Set();
  catalog.forEach(quote => {
    (Array.isArray(quote?.categoryCodes) ? quote.categoryCodes : []).forEach(code => {
      if (!knownCodes.has(code)) {
        unknownCodes.add(code);
      }
    });
  });
  return [...unknownCodes].sort();
}

function isProductionEligibleQuote(quote) {
  return quote
    && quote.verificationStatus === QUOTE_VERIFICATION_STATUS
    && quote.isActive === true
    && quote.contentValidation === QUOTE_CONTENT_VALIDATION_PASSED
    && quote.profanityValidation?.status === QUOTE_CONTENT_VALIDATION_PASSED
    && quote.profanityValidation?.code === QUOTE_PROFANITY_NOT_DETECTED
    && quote.rightsStatus !== QUOTE_RIGHTS_BLOCKED_STATUS
    && quote.displayLanguage === QUOTE_LANGUAGE
    && Array.isArray(quote.categoryCodes)
    && quote.categoryCodes.length > 0;
}

function getMissingRawQuoteFields(quote) {
  if (!quote || typeof quote !== "object" || Array.isArray(quote)) {
    return [...REQUIRED_RAW_QUOTE_FIELDS, "categoryCodes"];
  }

  const missingFields = REQUIRED_RAW_QUOTE_FIELDS.filter(field => !sanitizeReportValue(quote[field]));
  const categoryCodes = Array.isArray(quote.categoryCodes) ? quote.categoryCodes : quote.categories;
  if (!Array.isArray(categoryCodes) || categoryCodes.filter(Boolean).length === 0) {
    missingFields.push("categoryCodes");
  }
  return missingFields;
}

function normalizeQuoteTextForAudit(value) {
  return sanitizeReportValue(value).toLocaleLowerCase("ru-RU").replace(/\s+/g, " ");
}

function sanitizeReportValue(value) {
  return String(value || "").trim();
}

function createAuditHash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function runCli() {
  const args = process.argv.slice(2);
  const readOnly = !args.includes("--write-normalized");
  const dbPath = args.find(arg => !arg.startsWith("--")) || DEFAULT_PRODUCTION_QUOTE_DB_PATH;
  printJson(auditProductionQuotes(dbPath, { readOnly }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
