import { pathToFileURL } from "node:url";

import { createSyncDatabase } from "../server/sync-server.mjs";

export const CURATED_QUOTE_ID_PREFIX = "curated-quote";
export const CURATED_QUOTE_CREATED_AT = "2026-08-05T00:00:00.000Z";
export const RETIRED_GENERATED_QUOTE_ID_PREFIXES = ["focus-seed"];

const WIKISOURCE_URLS = {
  chekhovLetters: "https://ru.wikisource.org/wiki/%D0%9F%D0%B5%D1%80%D0%B5%D0%BF%D0%B8%D1%81%D0%BA%D0%B0_%D0%90._%D0%9F._%D0%A7%D0%B5%D1%85%D0%BE%D0%B2%D0%B0_%D0%B8_%D0%90%D0%BB._%D0%9F._%D0%A7%D0%B5%D1%85%D0%BE%D0%B2%D0%B0_(%D0%A7%D0%B5%D1%85%D0%BE%D0%B2)",
  griboedovWoeAct1: "https://ru.wikisource.org/wiki/%D0%93%D0%BE%D1%80%D0%B5_%D0%BE%D1%82_%D1%83%D0%BC%D0%B0_(%D0%93%D1%80%D0%B8%D0%B1%D0%BE%D0%B5%D0%B4%D0%BE%D0%B2)/%D0%9F%D0%A1%D0%A1_1911_(%D0%92%D0%A2)/%D0%94%D0%B5%D0%B9%D1%81%D1%82%D0%B2%D0%B8%D0%B5_I",
  oneginChapter1: "https://ru.wikisource.org/wiki/%D0%95%D0%B2%D0%B3%D0%B5%D0%BD%D0%B8%D0%B9_%D0%9E%D0%BD%D0%B5%D0%B3%D0%B8%D0%BD_(%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD)/%D0%9F%D0%A1%D0%A1_1977_(%D0%A1%D0%9E)/%D0%93%D0%BB%D0%B0%D0%B2%D0%B0_1",
  oneginChapter4: "https://ru.wikisource.org/wiki/%D0%95%D0%B2%D0%B3%D0%B5%D0%BD%D0%B8%D0%B9_%D0%9E%D0%BD%D0%B5%D0%B3%D0%B8%D0%BD_(%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD)/%D0%9F%D0%A1%D0%A1_1977_(%D0%A1%D0%9E)/%D0%93%D0%BB%D0%B0%D0%B2%D0%B0_4",
  pushkinProphet: "https://ru.wikisource.org/wiki/%D0%9F%D1%80%D0%BE%D1%80%D0%BE%D0%BA_(%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD)",
  tyutchevPrediction: "https://ru.wikisource.org/wiki/%D0%9D%D0%B0%D0%BC_%D0%BD%D0%B5_%D0%B4%D0%B0%D0%BD%D0%BE_%D0%BF%D1%80%D0%B5%D0%B4%D1%83%D0%B3%D0%B0%D0%B4%D0%B0%D1%82%D1%8C_(%D0%A2%D1%8E%D1%82%D1%87%D0%B5%D0%B2)/%D0%9F%D0%A1%D0%A1_1913_(%D0%94%D0%9E)",
  tyutchevSilentium: "https://ru.wikisource.org/wiki/Silentium!_(%D0%A2%D1%8E%D1%82%D1%87%D0%B5%D0%B2)/%D0%9F%D0%A1%D0%A1_1913_(%D0%94%D0%9E)",
  korolenkoParadox: "https://ru.wikisource.org/wiki/%D0%9F%D0%B0%D1%80%D0%B0%D0%B4%D0%BE%D0%BA%D1%81_(%D0%9A%D0%BE%D1%80%D0%BE%D0%BB%D0%B5%D0%BD%D0%BA%D0%BE)/%D0%9F%D0%A1%D0%A1_1914_(%D0%92%D0%A2:%D0%81)",
  prutkovThoughts: "https://ru.wikisource.org/wiki/%D0%9F%D0%BB%D0%BE%D0%B4%D1%8B_%D1%80%D0%B0%D0%B7%D0%B4%D1%83%D0%BC%D1%8C%D1%8F_(%D0%9F%D1%80%D1%83%D1%82%D0%BA%D0%BE%D0%B2)",
  prutkovThoughts1: "https://ru.wikisource.org/wiki/%D0%9C%D1%8B%D1%81%D0%BB%D0%B8_%D0%B8_%D0%B0%D1%84%D0%BE%D1%80%D0%B8%D0%B7%D0%BC%D1%8B_I_(%D0%9F%D1%80%D1%83%D1%82%D0%BA%D0%BE%D0%B2)",
  tolstoyAnna1: "https://ru.wikisource.org/wiki/%D0%90%D0%BD%D0%BD%D0%B0_%D0%9A%D0%B0%D1%80%D0%B5%D0%BD%D0%B8%D0%BD%D0%B0_(%D0%A2%D0%BE%D0%BB%D1%81%D1%82%D0%BE%D0%B9)/%D0%A7%D0%B0%D1%81%D1%82%D1%8C_I/%D0%93%D0%BB%D0%B0%D0%B2%D0%B0_I",
  krylovCasket: "https://ru.wikisource.org/wiki/%D0%9B%D0%B0%D1%80%D1%87%D0%B8%D0%BA_(%D0%9A%D1%80%D1%8B%D0%BB%D0%BE%D0%B2)",
  krylovCurious: "https://ru.wikisource.org/wiki/%D0%9B%D1%8E%D0%B1%D0%BE%D0%BF%D1%8B%D1%82%D0%BD%D1%8B%D0%B9_(%D0%9A%D1%80%D1%8B%D0%BB%D0%BE%D0%B2)",
  krylovSwan: "https://ru.wikisource.org/wiki/%D0%9B%D0%B5%D0%B1%D0%B5%D0%B4%D1%8C,_%D0%A9%D1%83%D0%BA%D0%B0_%D0%B8_%D0%A0%D0%B0%D0%BA_(%D0%9A%D1%80%D1%8B%D0%BB%D0%BE%D0%B2)",
};

export const CURATED_PRODUCTION_QUOTES = [
  quote({
    slug: "chekhov-brevity",
    text: "Краткость — сестра таланта.",
    authorName: "Антон Чехов",
    sourceTitle: "Переписка А. П. Чехова и Ал. П. Чехова",
    sourceType: "letter",
    sourceReference: "письмо Ал. П. Чехову от 11 апреля 1889 г.",
    sourceUrl: WIKISOURCE_URLS.chekhovLetters,
    publicationYear: 1889,
    categoryCodes: ["creativity", "self_development", "time_productivity", "work_vocation"],
  }),
  quote({
    slug: "griboedov-happy-hours",
    text: "Счастливые часов не наблюдают.",
    authorName: "Александр Грибоедов",
    sourceTitle: "Горе от ума",
    sourceType: "book",
    sourceReference: "действие I, явление 3",
    sourceUrl: WIKISOURCE_URLS.griboedovWoeAct1,
    publicationYear: 1825,
    categoryCodes: ["love_relationships", "life_wisdom", "time_productivity"],
  }),
  quote({
    slug: "pushkin-rule-yourself",
    text: "Учитесь властвовать собою.",
    authorName: "Александр Пушкин",
    sourceTitle: "Евгений Онегин",
    sourceType: "book",
    sourceReference: "глава IV, строфа XVI",
    sourceUrl: WIKISOURCE_URLS.oneginChapter4,
    publicationYear: 1828,
    categoryCodes: ["self_development", "calm_balance", "goals_success"],
  }),
  quote({
    slug: "pushkin-burn-hearts",
    text: "Глаголом жги сердца людей.",
    authorName: "Александр Пушкин",
    sourceTitle: "Пророк",
    sourceType: "book",
    sourceReference: "стихотворение, 1826",
    sourceUrl: WIKISOURCE_URLS.pushkinProphet,
    publicationYear: 1828,
    categoryCodes: ["creativity", "motivation", "work_vocation"],
  }),
  quote({
    slug: "tyutchev-word-response",
    text: "Нам не дано предугадать, как слово наше отзовется.",
    authorName: "Фёдор Тютчев",
    sourceTitle: "Нам не дано предугадать",
    sourceType: "book",
    sourceReference: "стихотворение, 1869",
    sourceUrl: WIKISOURCE_URLS.tyutchevPrediction,
    publicationYear: 1903,
    categoryCodes: ["life_wisdom", "friendship_people", "calm_balance"],
  }),
  quote({
    slug: "tyutchev-spoken-thought",
    text: "Мысль изреченная есть ложь.",
    authorName: "Фёдор Тютчев",
    sourceTitle: "Silentium!",
    sourceType: "book",
    sourceReference: "стихотворение, строка 10",
    sourceUrl: WIKISOURCE_URLS.tyutchevSilentium,
    publicationYear: 1833,
    categoryCodes: ["life_wisdom", "creativity", "calm_balance"],
  }),
  quote({
    slug: "korolenko-happiness-flight",
    text: "Человек создан для счастья, как птица для полёта.",
    authorName: "Владимир Короленко",
    sourceTitle: "Парадокс",
    sourceType: "book",
    sourceReference: "очерк, 1894",
    sourceUrl: WIKISOURCE_URLS.korolenkoParadox,
    publicationYear: 1894,
    categoryCodes: ["life_wisdom", "motivation", "calm_balance"],
  }),
  quote({
    slug: "prutkov-root",
    text: "Смотри в корень!",
    authorName: "Козьма Прутков",
    sourceTitle: "Плоды раздумья",
    sourceType: "book",
    sourceReference: "Мысли и афоризмы I, №5",
    sourceUrl: WIKISOURCE_URLS.prutkovThoughts1,
    publicationYear: 1854,
    categoryCodes: ["goals_success", "self_development", "business"],
  }),
  quote({
    slug: "prutkov-say-little",
    text: "Лучше скажи мало, но хорошо.",
    authorName: "Козьма Прутков",
    sourceTitle: "Плоды раздумья",
    sourceType: "book",
    sourceReference: "Мысли и афоризмы I, №6",
    sourceUrl: WIKISOURCE_URLS.prutkovThoughts1,
    publicationYear: 1854,
    categoryCodes: ["creativity", "self_development", "business"],
  }),
  quote({
    slug: "prutkov-science",
    text: "Наука изощряет ум; ученье вострит память.",
    authorName: "Козьма Прутков",
    sourceTitle: "Плоды раздумья",
    sourceType: "book",
    sourceReference: "Мысли и афоризмы I, №7",
    sourceUrl: WIKISOURCE_URLS.prutkovThoughts1,
    publicationYear: 1854,
    categoryCodes: ["self_development", "work_vocation", "creativity"],
  }),
  quote({
    slug: "prutkov-get-ready",
    text: "Принимаясь за дело, соберись с духом.",
    authorName: "Козьма Прутков",
    sourceTitle: "Плоды раздумья",
    sourceType: "book",
    sourceReference: "Мысли и афоризмы I, №56",
    sourceUrl: WIKISOURCE_URLS.prutkovThoughts1,
    publicationYear: 1854,
    categoryCodes: ["work_vocation", "goals_success", "business"],
  }),
  quote({
    slug: "prutkov-cannot-embrace",
    text: "Никто не обнимет необъятного.",
    authorName: "Козьма Прутков",
    sourceTitle: "Плоды раздумья",
    sourceType: "book",
    sourceReference: "Мысли и афоризмы I, №3",
    sourceUrl: WIKISOURCE_URLS.prutkovThoughts1,
    publicationYear: 1854,
    categoryCodes: ["life_wisdom", "goals_success", "time_productivity"],
  }),
  quote({
    slug: "prutkov-keep-watch",
    text: "Всегда держись начеку!",
    authorName: "Козьма Прутков",
    sourceTitle: "Плоды раздумья",
    sourceType: "book",
    sourceReference: "Мысли и афоризмы, №129",
    sourceUrl: WIKISOURCE_URLS.prutkovThoughts,
    publicationYear: 1854,
    categoryCodes: ["life_wisdom", "self_development", "calm_balance"],
  }),
  quote({
    slug: "prutkov-diligence",
    text: "Усердие все превозмогает!",
    authorName: "Козьма Прутков",
    sourceTitle: "Плоды раздумья",
    sourceType: "book",
    sourceReference: "Мысли и афоризмы, №84",
    sourceUrl: WIKISOURCE_URLS.prutkovThoughts,
    publicationYear: 1854,
    categoryCodes: ["motivation", "work_vocation", "goals_success"],
  }),
  quote({
    slug: "prutkov-happy",
    text: "Если хочешь быть счастливым, будь им.",
    authorName: "Козьма Прутков",
    sourceTitle: "Плоды раздумья",
    sourceType: "book",
    sourceReference: "Мысли и афоризмы, №80",
    sourceUrl: WIKISOURCE_URLS.prutkovThoughts,
    publicationYear: 1854,
    categoryCodes: ["motivation", "calm_balance", "health_self_care"],
  }),
  quote({
    slug: "prutkov-lost",
    text: "Что имеем — не храним; потерявши — плачем.",
    authorName: "Козьма Прутков",
    sourceTitle: "Плоды раздумья",
    sourceType: "book",
    sourceReference: "Мысли и афоризмы, №85",
    sourceUrl: WIKISOURCE_URLS.prutkovThoughts,
    publicationYear: 1854,
    categoryCodes: ["life_wisdom", "family_children", "calm_balance"],
  }),
  quote({
    slug: "prutkov-friendship",
    text: "В здании человеческого счастья дружба возводит стены, а любовь образует купол.",
    authorName: "Козьма Прутков",
    sourceTitle: "Плоды раздумья",
    sourceType: "book",
    sourceReference: "Мысли и афоризмы, №102",
    sourceUrl: WIKISOURCE_URLS.prutkovThoughts,
    publicationYear: 1854,
    categoryCodes: ["friendship_people", "love_relationships", "family_children"],
  }),
  quote({
    slug: "prutkov-wonder",
    text: "Глядя на мир, нельзя не удивляться!",
    authorName: "Козьма Прутков",
    sourceTitle: "Плоды раздумья",
    sourceType: "book",
    sourceReference: "Мысли и афоризмы, №110",
    sourceUrl: WIKISOURCE_URLS.prutkovThoughts,
    publicationYear: 1854,
    categoryCodes: ["life_wisdom", "creativity", "humor"],
  }),
  quote({
    slug: "tolstoy-families",
    text: "Все счастливые семьи похожи друг на друга.",
    authorName: "Лев Толстой",
    sourceTitle: "Анна Каренина",
    sourceType: "book",
    sourceReference: "часть I, глава I",
    sourceUrl: WIKISOURCE_URLS.tolstoyAnna1,
    publicationYear: 1875,
    categoryCodes: ["family_children", "life_wisdom", "love_relationships"],
  }),
  quote({
    slug: "pushkin-nails",
    text: "Быть можно дельным человеком и думать о красе ногтей.",
    authorName: "Александр Пушкин",
    sourceTitle: "Евгений Онегин",
    sourceType: "book",
    sourceReference: "глава I, строфа XXV",
    sourceUrl: WIKISOURCE_URLS.oneginChapter1,
    publicationYear: 1825,
    categoryCodes: ["self_development", "work_vocation", "humor"],
  }),
  quote({
    slug: "krylov-simple-casket",
    text: "А ларчик просто открывался.",
    authorName: "Иван Крылов",
    sourceTitle: "Ларчик",
    sourceType: "book",
    sourceReference: "басня, 1807",
    sourceUrl: WIKISOURCE_URLS.krylovCasket,
    publicationYear: 1808,
    categoryCodes: ["goals_success", "business", "humor"],
  }),
  quote({
    slug: "krylov-noticed-elephant",
    text: "Слона-то я и не приметил.",
    authorName: "Иван Крылов",
    sourceTitle: "Любопытный",
    sourceType: "book",
    sourceReference: "басня, 1814",
    sourceUrl: WIKISOURCE_URLS.krylovCurious,
    publicationYear: 1814,
    categoryCodes: ["self_development", "life_wisdom", "humor"],
  }),
  quote({
    slug: "krylov-agreement",
    text: "Когда в товарищах согласья нет, на лад их дело не пойдет.",
    authorName: "Иван Крылов",
    sourceTitle: "Лебедь, Щука и Рак",
    sourceType: "book",
    sourceReference: "басня, 1814",
    sourceUrl: WIKISOURCE_URLS.krylovSwan,
    publicationYear: 1814,
    categoryCodes: ["friendship_people", "business", "work_vocation"],
  }),
];

export function createCuratedProductionQuotes() {
  return CURATED_PRODUCTION_QUOTES.map(quoteRecord => ({
    ...quoteRecord,
    categoryCodes: [...quoteRecord.categoryCodes],
  }));
}

export function getCuratedProductionQuoteSummary(quotes = createCuratedProductionQuotes()) {
  const quoteList = Array.isArray(quotes) ? quotes : [];
  const categoryCounts = new Map();
  const authorCounts = new Map();

  quoteList.forEach(quoteRecord => {
    authorCounts.set(quoteRecord.authorName, (authorCounts.get(quoteRecord.authorName) || 0) + 1);
    quoteRecord.categoryCodes.forEach(code => {
      categoryCounts.set(code, (categoryCounts.get(code) || 0) + 1);
    });
  });

  return {
    quoteCount: quoteList.length,
    authorCount: authorCounts.size,
    sourceCount: new Set(quoteList.map(quoteRecord => quoteRecord.sourceUrl).filter(Boolean)).size,
    perAuthor: Object.fromEntries([...authorCounts.entries()].sort(([first], [second]) => first.localeCompare(second, "ru"))),
    perCategory: Object.fromEntries([...categoryCounts.entries()].sort(([first], [second]) => first.localeCompare(second))),
  };
}

export function importCuratedProductionQuotes(dbPath, { replaceGenerated = true } = {}) {
  if (!dbPath) {
    throw new Error("dbPath is required.");
  }

  const db = createSyncDatabase(dbPath);
  try {
    const curatedQuotes = createCuratedProductionQuotes();
    const existingQuotes = db.getQuoteCatalog();
    const removedGeneratedQuoteCount = replaceGenerated
      ? existingQuotes.filter(isRetiredGeneratedQuote).length
      : 0;
    const removedCuratedQuoteCount = existingQuotes.filter(isCuratedQuote).length;
    const preservedQuotes = existingQuotes.filter(quoteRecord => {
      if (isCuratedQuote(quoteRecord)) {
        return false;
      }
      if (replaceGenerated && isRetiredGeneratedQuote(quoteRecord)) {
        return false;
      }
      return true;
    });
    const saved = db.replaceQuoteCatalog({ quotes: [...preservedQuotes, ...curatedQuotes] });
    const audit = db.auditQuoteCatalogForProduction({ checkedAt: new Date().toISOString() });
    const importedCuratedQuotes = saved.quotes.filter(isCuratedQuote);

    return {
      status: "imported",
      dbPath,
      replaceGenerated,
      preservedQuoteCount: preservedQuotes.length,
      removedGeneratedQuoteCount,
      removedCuratedQuoteCount,
      curatedQuoteCount: curatedQuotes.length,
      importedCuratedQuoteCount: importedCuratedQuotes.length,
      totalQuoteCount: saved.quotes.length,
      audit,
      summary: getCuratedProductionQuoteSummary(importedCuratedQuotes),
    };
  } finally {
    db.close();
  }
}

function quote({
  slug,
  text,
  authorName,
  sourceTitle,
  sourceType,
  sourceReference,
  sourceUrl,
  publicationYear,
  categoryCodes,
}) {
  return {
    id: `${CURATED_QUOTE_ID_PREFIX}-${slug}`,
    text,
    authorName,
    authorNameOriginal: null,
    sourceTitle,
    sourceType,
    sourceReference,
    sourceUrl,
    publicationYear,
    originalLanguage: "ru",
    displayLanguage: "ru",
    verificationStatus: "verified",
    rightsStatus: "public_domain",
    rightsNote: "Произведение находится в общественном достоянии; источник сверки — Викитека.",
    mood: "balanced",
    isActive: true,
    verifiedBy: "quote-curation-script",
    verifiedAt: CURATED_QUOTE_CREATED_AT,
    createdAt: CURATED_QUOTE_CREATED_AT,
    updatedAt: CURATED_QUOTE_CREATED_AT,
    categoryCodes,
  };
}

function isCuratedQuote(quoteRecord) {
  return String(quoteRecord?.id || "").startsWith(`${CURATED_QUOTE_ID_PREFIX}-`);
}

function isRetiredGeneratedQuote(quoteRecord) {
  const id = String(quoteRecord?.id || "");
  return RETIRED_GENERATED_QUOTE_ID_PREFIXES.some(prefix => id.startsWith(`${prefix}-`));
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function runCli() {
  const [command = "summary", dbPath = "", ...flags] = process.argv.slice(2);
  const replaceGenerated = !flags.includes("--preserve-generated");

  if (command === "summary") {
    printJson(getCuratedProductionQuoteSummary());
    return;
  }

  if (command === "import") {
    printJson(importCuratedProductionQuotes(dbPath, { replaceGenerated }));
    return;
  }

  printJson({
    status: "failed",
    error: "unknown_command",
    usage: "node scripts/curated-production-quotes.mjs summary | import <dbPath> [--preserve-generated]",
  });
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
