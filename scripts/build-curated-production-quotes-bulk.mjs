import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createSyncDatabase } from "../server/sync-server.mjs";
import {
  CURATED_QUOTE_CREATED_AT,
  CURATED_QUOTE_ID_PREFIX,
  getCuratedProductionQuoteSummary,
  MANUAL_CURATED_PRODUCTION_QUOTES,
} from "./curated-production-quotes.mjs";

const TARGET_QUOTE_COUNT = 2000;
const OUTPUT_PATH = fileURLToPath(new URL("./curated-production-quotes.bulk.json", import.meta.url));
const CACHE_DIR = fileURLToPath(new URL("../.codex/wikisource-cache/", import.meta.url));
const WIKISOURCE_API_URL = "https://ru.wikisource.org/w/api.php";
const PAGE_NAMESPACE = 104;
const MAX_TEXT_LENGTH = 220;
const MIN_TEXT_LENGTH = 32;
const PAGE_CONTENT_BATCH_SIZE = 20;
const REQUEST_DELAY_MS = 1200;
const RETRY_DELAYS_MS = [5000, 15000, 30000, 60000];
let previousRequestAt = 0;
const CATEGORY_CODES = [
  "business",
  "calm_balance",
  "creativity",
  "family_children",
  "friendship_people",
  "goals_success",
  "health_self_care",
  "humor",
  "life_wisdom",
  "love_relationships",
  "motivation",
  "self_development",
  "time_productivity",
  "work_vocation",
];

const PAGE_RANGE_SOURCES = [
  {
    titlePrefix: "L. N. Tolstoy. All in 90 volumes. Volume 43.pdf/",
    pageStart: 10,
    pageEnd: 485,
    slugPrefix: "tolstoy-every-day-v43",
    sourceTitle: "На каждый день",
    sourceReferencePrefix: "часть I",
    publicationYear: 1910,
  },
  {
    titlePrefix: "L. N. Tolstoy. All in 90 volumes. Volume 44.pdf/",
    pageStart: 10,
    pageEnd: 475,
    slugPrefix: "tolstoy-every-day-v44",
    sourceTitle: "На каждый день",
    sourceReferencePrefix: "часть II",
    publicationYear: 1910,
  },
  {
    titlePrefix: "L. N. Tolstoy. All in 90 volumes. Volume 45.pdf/",
    pageStart: 10,
    pageEnd: 545,
    slugPrefix: "tolstoy-path-life-v45",
    sourceTitle: "Путь жизни",
    sourceReferencePrefix: "том 45",
    publicationYear: 1911,
  },
];

const NORMAL_PAGE_SOURCES = [
  {
    pageTitle: "Плоды раздумья (Прутков)",
    slugPrefix: "prutkov-fruits-bulk",
    authorName: "Козьма Прутков",
    sourceTitle: "Плоды раздумья",
    publicationYear: 1854,
    categoryCodes: ["humor", "life_wisdom", "self_development"],
  },
  {
    pageTitle: "Мысли и афоризмы I (Прутков)",
    slugPrefix: "prutkov-thoughts-one-bulk",
    authorName: "Козьма Прутков",
    sourceTitle: "Мысли и афоризмы I",
    publicationYear: 1854,
    categoryCodes: ["humor", "life_wisdom", "self_development"],
  },
  {
    pageTitle: "Мысли и афоризмы II (Прутков)",
    slugPrefix: "prutkov-thoughts-two-bulk",
    authorName: "Козьма Прутков",
    sourceTitle: "Мысли и афоризмы II",
    publicationYear: 1854,
    categoryCodes: ["humor", "life_wisdom", "self_development"],
  },
];

const ATTRIBUTION_ALIASES = new Map([
  ["еванг. иоанна", "Евангелие от Иоанна"],
  ["евангелие иоанна", "Евангелие от Иоанна"],
  ["еванг. матфея", "Евангелие от Матфея"],
  ["еванг. матф.", "Евангелие от Матфея"],
  ["еванг. луки", "Евангелие от Луки"],
  ["еванг. марка", "Евангелие от Марка"],
  ["кант", "Иммануил Кант"],
  ["марк аврелий", "Марк Аврелий"],
  ["мар. аврелий", "Марк Аврелий"],
  ["м. аврелий", "Марк Аврелий"],
  ["паскаль", "Блез Паскаль"],
  ["лао-тзе", "Лао-Цзы"],
  ["лао-цзы", "Лао-Цзы"],
  ["конфуций", "Конфуций"],
  ["сенека", "Сенека"],
  ["эпиктет", "Эпиктет"],
  ["эмерсон", "Ральф Уолдо Эмерсон"],
  ["торо", "Генри Дэвид Торо"],
  ["генри джордж", "Генри Джордж"],
  ["чэннинг", "Уильям Эллери Чэннинг"],
  ["шопенгауер", "Артур Шопенгауэр"],
  ["рускин", "Джон Рёскин"],
  ["рескин", "Джон Рёскин"],
  ["вовенарг", "Люк де Вовенарг"],
  ["магомет", "Мухаммед"],
  ["талмуд", "Талмуд"],
  ["дхаммапада", "Дхаммапада"],
  ["будда", "Будда"],
]);

const ADDITIONAL_ATTRIBUTION_ALIASES = new Map([
  ["амиелъ", "Амиель"],
  ["амиелю", "Амиель"],
  ["ангелусу силезиусу", "Ангелус Силезиус"],
  ["ангелусъ силезіусъ", "Ангелус Силезиус"],
  ["баллу", "Адин Балу"],
  ["балу", "Адин Балу"],
  ["браминского закона ману", "Законы Ману"],
  ["архангельскому", "Архангельский"],
  ["бернардъ шоу", "Бернард Шоу"],
  ["вивекананде", "Вивекананда"],
  ["генри джорджу", "Генри Джордж"],
  ["гераклиту", "Гераклит"],
  ["гоголь", "Николай Гоголь"],
  ["гоголю", "Николай Гоголь"],
  ["г. сковороде", "Григорий Сковорода"],
  ["гр. сковороде", "Григорий Сковорода"],
  ["григорию сковороде", "Григорий Сковорода"],
  ["сковорода", "Григорий Сковорода"],
  ["сковороде", "Григорий Сковорода"],
  ["дж. рёскину", "Джон Рёскин"],
  ["рёскин", "Джон Рёскин"],
  ["рёскину", "Джон Рёскин"],
  ["джеферсону", "Томас Джефферсон"],
  ["джефферсон", "Томас Джефферсон"],
  ["джефферсону", "Томас Джефферсон"],
  ["достоевский", "Фёдор Достоевский"],
  ["достоевскому", "Фёдор Достоевский"],
  ["иоанн златоуст,", "Иоанн Златоуст"],
  ["иоанну златоусту", "Иоанн Златоуст"],
  ["канту", "Иммануил Кант"],
  ["карлейлъ", "Томас Карлейль"],
  ["карлейль", "Томас Карлейль"],
  ["карлейлю", "Томас Карлейль"],
  ["кришне", "Кришна"],
  ["ксенофонту", "Ксенофонт"],
  ["ламеннэ", "Фелисите де Ламенне"],
  ["ламенэ", "Фелисите де Ламенне"],
  ["лао-тсе", "Лао-Цзы"],
  ["лao-тсе", "Лао-Цзы"],
  ["лao-tce", "Лао-Цзы"],
  ["л. толстой", "Лев Толстой"],
  ["лессинг", "Готхольд Лессинг"],
  ["лессингу", "Готхольд Лессинг"],
  ["лихтенберг", "Георг Лихтенберг"],
  ["лихтенбергу", "Георг Лихтенберг"],
  ["лихтпенберг", "Георг Лихтенберг"],
  ["люси маллори", "Люси Маллори"],
  ["люси малори", "Люси Маллори"],
  ["люси малоpu", "Люси Маллори"],
  ["магометъ", "Мухаммед"],
  ["мадзини", "Иосиф Мадзини"],
  ["марку аврелию", "Марк Аврелий"],
  ["мильтону", "Джон Мильтон"],
  ["монтень", "Мишель де Монтень"],
  ["монтэнь", "Мишель де Монтень"],
  ["мор", "Томас Мор"],
  ["паркер", "Паркер"],
  ["паскалю", "Блез Паскаль"],
  ["первое послание иоанна", "Первое послание Иоанна"],
  ["первое послание иоанна", "Первое послание Иоанна"],
  ["петр хелъчицкий", "Пётр Хельчицкий"],
  ["петр хельчицкий", "Пётр Хельчицкий"],
  ["псалом 38", "Псалтирь"],
  ["рамакришне", "Рамакришна"],
  ["беседы сократа", "Сократ"],
  ["прощальной беседы сократа с учениками", "Сократ"],
  ["речи сократа на суде", "Сократ"],
  ["сократу", "Сократ"],
  ["солтеру", "Солтер"],
  ["рихтеру", "Рихтер"],
  ["талмуду", "Талмуд"],
  ["цицерону", "Цицерон"],
  ["чаннинг", "Уильям Эллери Чаннинг"],
  ["чаннингу", "Уильям Эллери Чаннинг"],
  ["шопенгауеру", "Артур Шопенгауэр"],
  ["шопенгауэру", "Артур Шопенгауэр"],
  ["шопенгауэр", "Артур Шопенгауэр"],
  ["шопепгауер", "Артур Шопенгауэр"],
  ["карпентер", "Эдвард Карпентер"],
  ["э. карпентер", "Эдвард Карпентер"],
  ["эмерсону", "Ральф Уолдо Эмерсон"],
  ["эмерсонъ", "Ральф Уолдо Эмерсон"],
  ["эпиктету", "Эпиктет"],
  ["эразму", "Эразм Роттердамский"],
  ["ювеналу", "Ювенал"],
  ["cаади", "Саади"],
  ["учение 12 апостолов", "Учение двенадцати апостолов"],
  ["«учение 12 апостолов»", "Учение двенадцати апостолов"],
]);

const REJECTED_ATTRIBUTION_PATTERNS = [
  /^к$/iu,
  /^род$/iu,
  /^размер подлинника$/iu,
  /^с (?:английского|арабского|восточного|китайского|персидского)$/iu,
  /^(?:английского|квакерского) журнала/iu,
];

async function main() {
  const existingQuotes = MANUAL_CURATED_PRODUCTION_QUOTES.map(quoteRecord => ({
    ...quoteRecord,
    categoryCodes: [...quoteRecord.categoryCodes],
  }));
  const neededQuoteCount = TARGET_QUOTE_COUNT - existingQuotes.length;
  if (neededQuoteCount <= 0) {
    printJson({ status: "skipped", reason: "target_already_reached", currentQuoteCount: existingQuotes.length });
    return;
  }

  const existingTextHashes = new Set(existingQuotes.map(quoteRecord => createTextHash(quoteRecord.text)));
  const existingIds = new Set(existingQuotes.map(quoteRecord => quoteRecord.id));
  const candidates = [];

  for (const source of PAGE_RANGE_SOURCES) {
    const pages = await fetchPageRangeSource(source);
    for (const page of pages) {
      candidates.push(...extractAttributedPageCandidates(page, source));
    }
  }

  for (const source of NORMAL_PAGE_SOURCES) {
    const page = await fetchNormalPage(source.pageTitle);
    candidates.push(...extractNormalPageCandidates(page, source));
  }

  const uniqueCandidates = removeDuplicateCandidates(candidates, { existingIds, existingTextHashes });
  const cleanCandidates = filterCandidatesWithFocusValidation(uniqueCandidates);
  const selected = selectCandidates(cleanCandidates, {
    existingQuotes,
    neededQuoteCount,
    targetQuoteCount: TARGET_QUOTE_COUNT,
  });

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(selected, null, 2)}\n`, "utf8");
  printJson({
    status: selected.length + existingQuotes.length >= TARGET_QUOTE_COUNT ? "built" : "partial",
    outputPath: OUTPUT_PATH,
    existingQuoteCount: existingQuotes.length,
    candidateCount: candidates.length,
    uniqueCandidateCount: uniqueCandidates.length,
    cleanCandidateCount: cleanCandidates.length,
    selectedQuoteCount: selected.length,
    finalQuoteCount: existingQuotes.length + selected.length,
    existingSummary: getCuratedProductionQuoteSummary(existingQuotes),
    selectedSummary: getCandidateSummary(selected),
  });
}

async function fetchPageRangeSource(source) {
  const titles = await fetchAllPageTitles(source.titlePrefix);
  const selectedTitles = titles
    .map(title => ({ title, pageNumber: getPageNumber(title) }))
    .filter(page => page.pageNumber >= source.pageStart && page.pageNumber <= source.pageEnd)
    .sort((first, second) => first.pageNumber - second.pageNumber);
  const pages = [];

  for (const batch of chunk(selectedTitles, PAGE_CONTENT_BATCH_SIZE)) {
    const pageContents = await fetchPageContents(batch.map(page => page.title));
    for (const page of batch) {
      const content = pageContents.get(page.title);
      if (content) {
        pages.push({ ...page, wikitext: content });
      }
    }
  }

  return pages;
}

async function fetchAllPageTitles(titlePrefix) {
  const titles = [];
  let continueToken = "";

  do {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      list: "allpages",
      apnamespace: String(PAGE_NAMESPACE),
      apprefix: titlePrefix,
      aplimit: "500",
    });
    if (continueToken) {
      params.set("apcontinue", continueToken);
    }

    const response = await fetchJson(params);
    titles.push(...(response.query?.allpages || []).map(page => page.title));
    continueToken = response.continue?.apcontinue || "";
  } while (continueToken);

  return titles;
}

async function fetchPageContents(titles) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    titles: titles.join("|"),
  });
  const response = await fetchJson(params);
  const contents = new Map();

  for (const page of response.query?.pages || []) {
    const content = page.revisions?.[0]?.slots?.main?.content;
    if (typeof content === "string") {
      contents.set(page.title, content);
    }
  }

  return contents;
}

async function fetchNormalPage(pageTitle) {
  const params = new URLSearchParams({
    action: "parse",
    format: "json",
    page: pageTitle,
    prop: "wikitext",
  });
  const response = await fetchJson(params);
  return {
    title: response.parse?.title || pageTitle,
    pageNumber: 0,
    wikitext: response.parse?.wikitext?.["*"] || "",
  };
}

async function fetchJson(params) {
  const url = `${WIKISOURCE_API_URL}?${params.toString()}`;
  const cachePath = getCachePath(url);
  if (existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, "utf8"));
  }
  mkdirSync(CACHE_DIR, { recursive: true });

  let lastError;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      await waitForRequestSlot();
      const response = await fetch(url, {
        headers: {
          "Api-User-Agent": "FocusQuoteCatalogBuilder/1.0",
          "User-Agent": "FocusQuoteCatalogBuilder/1.0",
        },
      });

      if (response.ok) {
        const json = await response.json();
        writeFileSync(cachePath, `${JSON.stringify(json)}\n`, "utf8");
        return json;
      }

      if (![429, 503].includes(response.status)) {
        throw new Error(`Wikisource request failed: ${response.status}`);
      }
      lastError = new Error(`Wikisource request failed: ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_DELAYS_MS.length) {
        break;
      }
    }

    await sleep(RETRY_DELAYS_MS[attempt]);
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Wikisource request failed after retries: ${message}`);
}

async function waitForRequestSlot() {
  const elapsed = Date.now() - previousRequestAt;
  if (elapsed < REQUEST_DELAY_MS) {
    await sleep(REQUEST_DELAY_MS - elapsed);
  }
  previousRequestAt = Date.now();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getCachePath(url) {
  const hash = createHash("sha256").update(url).digest("hex");
  return join(CACHE_DIR, `${hash}.json`);
}

function extractAttributedPageCandidates(page, source) {
  const candidates = [];
  const rightPattern = /\{\{right2\|([\s\S]*?)\}\}/g;
  let cursor = 0;
  let entryIndex = 0;
  let match;

  while ((match = rightPattern.exec(page.wikitext)) !== null) {
    const block = page.wikitext.slice(cursor, match.index);
    cursor = match.index + match[0].length;
    entryIndex += 1;

    const authorName = normalizeAttribution(match[1]);
    if (!authorName) {
      continue;
    }

    const quoteBlock = getLastQuoteBlock(block);
    for (const text of createTextVariants(cleanWikiText(quoteBlock))) {
      if (!isUsableQuoteText(text)) {
        continue;
      }
      const categoryCodes = assignCategories(text, {
        authorName,
        fallback: ["life_wisdom", "self_development"],
      });
      candidates.push({
        slug: createSlug(`${source.slugPrefix}-${page.pageNumber}-${entryIndex}-${candidates.length + 1}`),
        text,
        authorName,
        sourceTitle: source.sourceTitle,
        sourceType: "book",
        sourceReference: `${source.sourceReferencePrefix}, страница ${page.pageNumber}, запись ${entryIndex}`,
        sourceUrl: createWikisourceUrl(page.title),
        publicationYear: source.publicationYear,
        categoryCodes,
      });
    }
  }

  return candidates;
}

function extractNormalPageCandidates(page, source) {
  const candidates = [];
  const text = cleanWikiText(page.wikitext)
    .replace(/^#+\s*/gm, "")
    .replace(/^\d+\s*$/gm, "\n");
  const lines = text
    .split(/\n+/u)
    .map(line => normalizeWhitespace(line.replace(/^\d+[.)]?\s*/u, "")))
    .filter(Boolean);

  for (const line of lines) {
    for (const textVariant of createTextVariants(line)) {
      if (!isUsableQuoteText(textVariant)) {
        continue;
      }
      candidates.push({
        slug: createSlug(`${source.slugPrefix}-${candidates.length + 1}`),
        text: textVariant,
        authorName: source.authorName,
        sourceTitle: source.sourceTitle,
        sourceType: "book",
        sourceReference: `афоризм ${candidates.length + 1}`,
        sourceUrl: createWikisourceUrl(page.title),
        publicationYear: source.publicationYear,
        categoryCodes: uniqueCategoryCodes(source.categoryCodes),
      });
    }
  }

  return candidates;
}

function getLastQuoteBlock(block) {
  const parts = block.split(/\{\{(?:центр|center|c)\|[^{}]*\}\}/giu);
  return parts[parts.length - 1] || block;
}

function cleanWikiText(value) {
  let text = String(value || "")
    .replace(/<noinclude[\s\S]*?<\/noinclude>/giu, "\n")
    .replace(/<ref[\s\S]*?<\/ref>/giu, "")
    .replace(/<ref[^>]*\/>/giu, "")
    .replace(/<!--[\s\S]*?-->/gu, "")
    .replace(/<section[^>]*\/>/giu, "\n")
    .replace(/<section[^>]*>/giu, "\n")
    .replace(/<\/section>/giu, "\n")
    .replace(/\[\[(?:Файл|File|Категория|Category):[^\]]+\]\]/giu, "")
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/gu, "$1")
    .replace(/\[\[([^\]]+)\]\]/gu, "$1")
    .replace(/\{\{акут\}\}/giu, "")
    .replace(/\{\{nobr\|([^{}]*)\}\}/giu, "$1")
    .replace(/\{\{lang\|[^|{}]+\|([^{}]*)\}\}/giu, "$1")
    .replace(/\{\{[Rr]azr\|([^{}]*)\}\}/gu, "$1")
    .replace(/\{\{[^\n{}]*\}\}/gu, "")
    .replace(/'{2,}/gu, "")
    .replace(/&nbsp;/giu, " ")
    .replace(/&quot;/giu, "\"")
    .replace(/&laquo;/giu, "«")
    .replace(/&raquo;/giu, "»")
    .replace(/&mdash;/giu, "—")
    .replace(/&ndash;/giu, "–")
    .replace(/<[^>]+>/gu, " ");

  text = text.replace(/[ \t]+\n/gu, "\n");
  return normalizeWhitespace(text);
}

function createTextVariants(text) {
  const normalized = normalizeQuotePunctuation(text);
  if (!normalized) {
    return [];
  }
  if (normalized.length <= MAX_TEXT_LENGTH) {
    return [normalized];
  }

  return normalized
    .split(/(?<=[.!?…])\s+/u)
    .map(sentence => normalizeQuotePunctuation(sentence))
    .filter(sentence => sentence.length >= MIN_TEXT_LENGTH && sentence.length <= MAX_TEXT_LENGTH);
}

function normalizeQuotePunctuation(text) {
  return normalizeWhitespace(text)
    .replace(/^[—–\-*•\s]+/u, "")
    .replace(/\s+([,.;:!?…])/gu, "$1")
    .replace(/([«])\s+/gu, "$1")
    .replace(/\s+([»])/gu, "$1")
    .replace(/\s+—\s+/gu, " — ")
    .trim();
}

function normalizeAttribution(rawValue) {
  let value = cleanWikiText(rawValue)
    .replace(/^по\s+/iu, "")
    .replace(/^из\s+/iu, "")
    .replace(/\([^)]*\)/gu, "")
    .replace(/\s*,\s*(?:гл|ст|стр|кн|т|том|ч|cm)\.?.*$/iu, "")
    .replace(/\s*\.\s*$/u, "")
    .trim();

  if (!value || value.length > 64 || /[{}[\]<>|=]/u.test(value)) {
    return "";
  }

  value = canonicalizeAttribution(value);
  if (!value || isRejectedAttribution(value)) {
    return "";
  }
  return value;
}

function canonicalizeAttribution(value) {
  const normalized = normalizeAttributionKey(value);

  if (/^(?:мф|мат\.?|матф|матфея)(?:\b|[.,\s])/iu.test(normalized) || normalized === "мат") {
    return "Евангелие от Матфея";
  }
  if (/^(?:ин\.?|иоан\.?|иоанн|иоан,|иоанна)(?:\b|[.,\s])/iu.test(normalized) || normalized === "иоанна") {
    return "Евангелие от Иоанна";
  }
  if (/^(?:лук|луки|лука)(?:\b|[.,\s])/iu.test(normalized) || normalized === "луки" || normalized === "лука") {
    return "Евангелие от Луки";
  }
  if (/^i\s*кор/iu.test(normalized)) {
    return "Первое послание к Коринфянам";
  }
  if (/^i\s*посл.*иоан/iu.test(normalized)) {
    return "Первое послание Иоанна";
  }

  return ADDITIONAL_ATTRIBUTION_ALIASES.get(normalized)
    || ATTRIBUTION_ALIASES.get(normalized)
    || value;
}

function normalizeAttributionKey(value) {
  return String(value || "")
    .toLocaleLowerCase("ru")
    .replace(/[’']/gu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

function isRejectedAttribution(value) {
  const normalized = normalizeAttributionKey(value);
  return REJECTED_ATTRIBUTION_PATTERNS.some(pattern => pattern.test(normalized));
}

function isUsableQuoteText(text) {
  if (text.length < MIN_TEXT_LENGTH || text.length > MAX_TEXT_LENGTH) {
    return false;
  }
  if (!/[А-Яа-яЁё]/u.test(text)) {
    return false;
  }
  if (/[{}[\]<>|=]/u.test(text)) {
    return false;
  }
  if (/https?:|www\.|категория:|файл:|источник|примечания|править|pagequality/iu.test(text)) {
    return false;
  }
  if (/^\W*\d+\W*$/u.test(text)) {
    return false;
  }
  if (!/[.!?…]$/u.test(text)) {
    return false;
  }
  const words = text.split(/\s+/u).filter(Boolean);
  if (words.length < 5 || words.length > 42) {
    return false;
  }
  return true;
}

function assignCategories(text, { authorName = "", fallback = ["life_wisdom"] } = {}) {
  const lower = text.toLocaleLowerCase("ru");
  const categories = new Set(fallback);

  addByKeywords(categories, lower, "love_relationships", ["любов", "сердц", "любить", "любви", "ненавист"]);
  addByKeywords(categories, lower, "family_children", ["семь", "дет", "ребен", "сын", "дочь", "отец", "мать", "родител"]);
  addByKeywords(categories, lower, "friendship_people", ["друг", "люд", "человек", "ближн", "общеж", "отнош"]);
  addByKeywords(categories, lower, "health_self_care", ["здоров", "болез", "тело", "душ", "страх", "гнев", "печал", "страдан", "спокой"]);
  addByKeywords(categories, lower, "work_vocation", ["труд", "работ", "служ", "ремесл", "дело", "обязан", "занят"]);
  addByKeywords(categories, lower, "business", ["деньг", "богат", "бедн", "собствен", "закон", "государ", "власть", "общество", "торгов"]);
  addByKeywords(categories, lower, "goals_success", ["цель", "успех", "достиг", "побед", "стрем", "усили", "намерен"]);
  addByKeywords(categories, lower, "time_productivity", ["время", "день", "час", "мину", "сейчас", "сегодня", "завтра", "всегда"]);
  addByKeywords(categories, lower, "creativity", ["мысл", "слово", "книга", "искус", "поэз", "знан", "учен", "истин"]);
  addByKeywords(categories, lower, "humor", ["смеш", "смех", "шут", "острот", "глуп", "смешон"]);
  addByKeywords(categories, lower, "calm_balance", ["мир", "покой", "терп", "смир", "тих", "спокой", "молчи", "гнев"]);
  addByKeywords(categories, lower, "motivation", ["мож", "надо", "долж", "сила", "верь", "делай", "поступ", "станет"]);

  if (authorName === "Козьма Прутков") {
    categories.add("humor");
  }

  if (categories.size < 2) {
    categories.add("self_development");
  }

  return uniqueCategoryCodes([...categories].slice(0, 5));
}

function addByKeywords(categories, text, categoryCode, keywords) {
  if (keywords.some(keyword => text.includes(keyword))) {
    categories.add(categoryCode);
  }
}

function uniqueCategoryCodes(categoryCodes) {
  const normalized = [];
  for (const code of categoryCodes) {
    if (CATEGORY_CODES.includes(code) && !normalized.includes(code)) {
      normalized.push(code);
    }
  }
  return normalized.length ? normalized : ["life_wisdom"];
}

function removeDuplicateCandidates(candidates, { existingIds, existingTextHashes }) {
  const seenIds = new Set(existingIds);
  const seenTexts = new Set(existingTextHashes);
  const unique = [];

  for (const candidate of candidates) {
    const id = `${CURATED_QUOTE_ID_PREFIX}-${candidate.slug}`;
    const textHash = createTextHash(candidate.text);
    if (seenIds.has(id) || seenTexts.has(textHash)) {
      continue;
    }
    seenIds.add(id);
    seenTexts.add(textHash);
    unique.push(candidate);
  }

  return unique;
}

function filterCandidatesWithFocusValidation(candidates) {
  const db = createSyncDatabase(":memory:");
  try {
    db.replaceQuoteCatalog({ quotes: candidates.map(createQuoteRecordForValidation) });
    const normalizedQuotes = db.getQuoteCatalog();
    const normalizedIds = new Set(normalizedQuotes.map(quoteRecord => quoteRecord.id));
    const blockedIds = new Set(
      normalizedQuotes
        .filter(quoteRecord => quoteRecord.profanityValidation?.status === "failed")
        .map(quoteRecord => quoteRecord.id),
    );

    return candidates.filter(candidate => {
      const id = `${CURATED_QUOTE_ID_PREFIX}-${candidate.slug}`;
      return normalizedIds.has(id) && !blockedIds.has(id);
    });
  } finally {
    db.close();
  }
}

function createQuoteRecordForValidation(candidate) {
  return {
    id: `${CURATED_QUOTE_ID_PREFIX}-${candidate.slug}`,
    text: candidate.text,
    authorName: candidate.authorName,
    sourceTitle: candidate.sourceTitle,
    sourceType: candidate.sourceType,
    sourceReference: candidate.sourceReference,
    sourceUrl: candidate.sourceUrl,
    publicationYear: candidate.publicationYear,
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
    categoryCodes: candidate.categoryCodes,
  };
}

function selectCandidates(candidates, { existingQuotes, neededQuoteCount, targetQuoteCount }) {
  const selected = [];
  const categoryCounts = new Map(CATEGORY_CODES.map(code => [code, 0]));
  const authorCounts = new Map();
  const sourceCounts = new Map();
  const remaining = candidates.slice();
  const categoryTarget = Math.ceil(targetQuoteCount / CATEGORY_CODES.length);

  for (const quoteRecord of existingQuotes) {
    for (const code of quoteRecord.categoryCodes || []) {
      categoryCounts.set(code, (categoryCounts.get(code) || 0) + 1);
    }
    authorCounts.set(quoteRecord.authorName, (authorCounts.get(quoteRecord.authorName) || 0) + 1);
  }

  while (selected.length < neededQuoteCount && remaining.length) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const categoryDeficit = candidate.categoryCodes
        .reduce((sum, code) => sum + Math.max(0, categoryTarget - (categoryCounts.get(code) || 0)), 0);
      const authorPenalty = (authorCounts.get(candidate.authorName) || 0) * 0.25;
      const sourcePenalty = (sourceCounts.get(candidate.sourceUrl) || 0) * 0.05;
      const lengthBonus = 1 - Math.abs(candidate.text.length - 110) / 220;
      const score = categoryDeficit * 10 + lengthBonus - authorPenalty - sourcePenalty;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    const [candidate] = remaining.splice(bestIndex, 1);
    selected.push(candidate);
    for (const code of candidate.categoryCodes) {
      categoryCounts.set(code, (categoryCounts.get(code) || 0) + 1);
    }
    authorCounts.set(candidate.authorName, (authorCounts.get(candidate.authorName) || 0) + 1);
    sourceCounts.set(candidate.sourceUrl, (sourceCounts.get(candidate.sourceUrl) || 0) + 1);
  }

  return selected;
}

function getCandidateSummary(candidates) {
  const categoryCounts = new Map();
  const authorCounts = new Map();

  for (const candidate of candidates) {
    authorCounts.set(candidate.authorName, (authorCounts.get(candidate.authorName) || 0) + 1);
    for (const code of candidate.categoryCodes) {
      categoryCounts.set(code, (categoryCounts.get(code) || 0) + 1);
    }
  }

  return {
    quoteCount: candidates.length,
    authorCount: authorCounts.size,
    sourceCount: new Set(candidates.map(candidate => candidate.sourceUrl)).size,
    perAuthor: Object.fromEntries([...authorCounts.entries()].sort(([first], [second]) => first.localeCompare(second, "ru"))),
    perCategory: Object.fromEntries([...categoryCounts.entries()].sort(([first], [second]) => first.localeCompare(second))),
  };
}

function createTextHash(text) {
  return createHash("sha256")
    .update(String(text || "").toLocaleLowerCase("ru").replace(/\s+/gu, " ").trim())
    .digest("hex");
}

function createSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 90);
}

function getPageNumber(title) {
  const match = String(title || "").match(/\/(\d+)$/u);
  return match ? Number(match[1]) : 0;
}

function createWikisourceUrl(title) {
  return `https://ru.wikisource.org/wiki/${encodeURIComponent(String(title).replace(/\s+/gu, "_")).replace(/%2F/gu, "/").replace(/%3A/gu, ":")}`;
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/gu, " ").trim();
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
