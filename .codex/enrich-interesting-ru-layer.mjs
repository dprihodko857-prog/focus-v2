import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  DEFAULT_INTERESTING_TODAY_CATALOG,
  normalizeInterestingTodayCatalog,
} from "../server/interesting-today-catalog.mjs";

const NEXT_VERSION = "interesting-today-ru@2027-08-04.v6";
const CATALOG_PATH = "server/interesting-today-catalog.mjs";
const CACHE_DIR = ".codex/interesting-today-calend-ru-cache";
const MIN_RU_PER_SECTION = 2;
const USER_AGENT = "FocusInterestingTodayCatalog/1.0";

const EVENT_THEME_RULES = [
  [["space", "science"], /космос|космич|спутник|ракета|луна|марс|орбит|космонав/i],
  [["science", "technology"], /учён|науч|открыт|экспедиц|географ|физик|хими|биолог|медицин/i],
  [["technology", "society"], /запущ|изобрет|самол|железн|мост|метро|телефон|телеграф|станци|электр|курант/i],
  [["military", "state"], /войн|битв|сраж|осад|армия|войск|фронт|операц|оборона|наступатель|восстан|бунт/i],
  [["diplomacy", "state"], /договор|соглаш|подпис|мирн|дипломат|конференц|посольств/i],
  [["state", "society"], /независим|конституц|избран|президент|царь|император|правительств|закон|республика|основан|учрежден|учреждён/i],
  [["literature", "culture"], /опублик|роман|книг|пьес|поэм|газет|журнал/i],
  [["culture", "art"], /премьера|фильм|театр|музе|опера|симфони|памятник|выстав|картина/i],
  [["sports", "society"], /олимп|чемпионат|матч|турнир|спорт|хокке|футбол/i],
];

const PERSON_THEME_RULES = [
  [["space", "science"], /космонав|астронав/i],
  [["science"], /учён|учен|математик|физик|химик|биолог|астроном|изобретател|врач|психолог|географ|инженер/i],
  [["literature", "culture"], /писател|поэт|драматург|литератур|журналист|философ|историк|публицист/i],
  [["culture", "art"], /худож|композитор|акт[её]р|актрис|режисс|пев|музыкант|балерин|танцов|архитектор|скульптор|дириж[её]р/i],
  [["state", "diplomacy"], /политик|президент|министр|премьер|царь|цариц|государствен|дипломат|обществен/i],
  [["military", "state"], /военачаль|полковод|генерал|адмирал|маршал|л[её]тчик|герой советского союза|герой российской федерации/i],
  [["sports"], /спортсмен|футболист|хоккеист|теннисист|фигурист|олимпийск|чемпион/i],
];

const RUSSIAN_CONTEXT_PATTERN = /росси|русск|советск|ссср|рсфср|российской импер|москов|петербург|санкт-петербург|ленинград|сталинград|волгоград|кремл|астрахан|казан|новгород|ярослав|владимир|псков|твер|самар|саратов|нижегород|сибир|ураль|карели|кубан|донск|крым|советской социалистической|украинской сср|белорусской сср|казахской сср|грузинской сср|армянской сср|азербайджанской сср|молдавской сср|эстонской сср|латвийской сср|литовской сср|киргизской сср|таджикской сср|туркменской сср|узбекской сср/i;
const RUSSIAN_STRONG_TITLE_PATTERN = /росси|русск|советск|ссср|рсфср|москов|петербург|санкт-петербург|ленинград|сталинград|волгоград|новгород|псков|княз|кремл|аэрофлот|ту-104|одесс|ржев|керчен|декабрист|солжениц|кафельников|новодевич|брюсов|петровск|луна-16/i;
const FOREIGN_ONLY_EVENT_TITLE_PATTERN = /лондон|бейкер-стрит|шерлок|холмс|greenpeace|android|camp nou|барселон|хонда|observer|американск|сша|нью-йорк/i;
const BAD_PERSON_PATTERN = /ютуб|youtube|tik ?tok|блогер|стример|киберспорт|модель/i;

function createCoverageDates() {
  const dates = [];
  const start = new Date(Date.UTC(2026, 7, 5));
  const end = new Date(Date.UTC(2027, 7, 4));
  for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    dates.push(date.toISOString().slice(0, 10));
  }
  dates.push("2028-02-29");
  return dates;
}

function partsFromDate(localDate) {
  return {
    month: Number(localDate.slice(5, 7)),
    day: Number(localDate.slice(8, 10)),
  };
}

function keyFor(month, day) {
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function cleanText(value) {
  return decodeHtml(String(value || ""))
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function truncate(value, maxLength) {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  const sliced = text.slice(0, maxLength - 1);
  const boundary = Math.max(sliced.lastIndexOf(". "), sliced.lastIndexOf("; "), sliced.lastIndexOf(", "));
  return `${sliced.slice(0, boundary > 90 ? boundary : maxLength - 1).trim()}...`;
}

function ensurePeriod(value) {
  const text = cleanText(value);
  return /[.!?…]$/.test(text) ? text : `${text}.`;
}

function normalizeComparable(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[«»"“”„]/g, "")
    .replace(/[.,!?;:—–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  const translit = String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[ъь]/g, "")
    .replace(/ё/g, "e")
    .replace(/ж/g, "zh")
    .replace(/х/g, "kh")
    .replace(/ц/g, "ts")
    .replace(/ч/g, "ch")
    .replace(/ш/g, "sh")
    .replace(/щ/g, "shch")
    .replace(/ю/g, "yu")
    .replace(/я/g, "ya")
    .replace(/а/g, "a")
    .replace(/б/g, "b")
    .replace(/в/g, "v")
    .replace(/г/g, "g")
    .replace(/д/g, "d")
    .replace(/е/g, "e")
    .replace(/з/g, "z")
    .replace(/и/g, "i")
    .replace(/й/g, "y")
    .replace(/к/g, "k")
    .replace(/л/g, "l")
    .replace(/м/g, "m")
    .replace(/н/g, "n")
    .replace(/о/g, "o")
    .replace(/п/g, "p")
    .replace(/р/g, "r")
    .replace(/с/g, "s")
    .replace(/т/g, "t")
    .replace(/у/g, "u")
    .replace(/ф/g, "f")
    .replace(/ы/g, "y")
    .replace(/э/g, "e");
  return translit
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "record";
}

function hashShort(value) {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, 8);
}

function uniqueId(base, usedIds) {
  let id = base.slice(0, 172).replace(/-+$/g, "");
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${base.slice(0, 160)}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

function isRuRecord(record) {
  return record.primaryCountryCode === "RU" || record.countryCodes?.includes("RU");
}

function inferThemes(text, rules, fallback) {
  for (const [themes, pattern] of rules) {
    if (pattern.test(text)) return themes;
  }
  return fallback;
}

function eventScore(candidate) {
  const text = `${candidate.title} ${candidate.description}`;
  let score = 78;
  if (/росси|русск|советск|ссср|москв|петербург|ленинград/i.test(text)) score += 8;
  if (/основан|учрежден|учреждён|перв|войск|операц|памятник|открыт|запущ|создан/i.test(text)) score += 6;
  if (candidate.year < 1900) score += 4;
  if (candidate.year < 1700) score += 4;
  return Math.max(72, Math.min(90, score));
}

function personScore(candidate) {
  const text = `${candidate.name} ${candidate.summary} ${candidate.description}`;
  let score = 78;
  if (/российск|русск|советск|ссср|герой|народный артист|лауреат|академик|космонавт/i.test(text)) score += 8;
  if (/писател|поэт|композитор|худож|уч[её]н|политик|государствен|генерал|л[её]тчик|акт[её]р|режисс/i.test(text)) score += 5;
  if (candidate.birthYear < 1900) score += 4;
  if (candidate.birthYear < 1700) score += 4;
  return Math.max(72, Math.min(90, score));
}

function recordIdentity({ type, month, day, year, title }) {
  return `${type}:${month}:${day}:${year}:${normalizeComparable(title)}`;
}

async function fetchCalend(kind, month, day) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = `${CACHE_DIR}/${kind}-${month}-${day}.html`;
  if (existsSync(cachePath)) {
    return readFileSync(cachePath, "utf8");
  }

  const datePath = month === 2 && day === 29 ? `2028-${month}-${day}` : `${month}-${day}`;
  const url = `https://www.calend.ru/${kind}/${datePath}/`;
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      "accept-language": "ru-RU,ru;q=0.9",
    },
  });
  if (!response.ok) {
    console.warn(`Calend fetch skipped: ${response.status} ${url}`);
    return "";
  }
  const html = await response.text();
  writeFileSync(cachePath, html, "utf8");
  await new Promise(resolve => setTimeout(resolve, 120));
  return html;
}

function absolutizeCalendUrl(url) {
  const value = decodeHtml(url || "");
  if (value.startsWith("http")) return value;
  return `https://www.calend.ru${value}`;
}

function parseEvents(html, month, day) {
  const blocks = html.match(/<li class="three-three"[\s\S]*?<\/li>/g) || [];
  return blocks.flatMap(block => {
    const yearText = cleanText(block.match(/<span class="year[^"]*">\s*([\s\S]*?)<\/span>/)?.[1] || "");
    const year = Number(yearText.match(/\d{3,4}/)?.[0] || "");
    const titleMatch = block.match(/<span class="title">\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    const descriptionMatch = block.match(/<p class="descr[^"]*">\s*<a[^>]+>([\s\S]*?)<\/a>/);
    const title = cleanText(titleMatch?.[2] || "");
    const description = truncate(descriptionMatch?.[1] || "", 320);
    const sourceUrl = absolutizeCalendUrl(titleMatch?.[1] || `/events/${month}-${day}/`);
    const text = `${title} ${description.slice(0, 180)}`;
    const hasRussianContext = RUSSIAN_STRONG_TITLE_PATTERN.test(title) || RUSSIAN_CONTEXT_PATTERN.test(text);
    const hasForeignOnlyTitle = FOREIGN_ONLY_EVENT_TITLE_PATTERN.test(title) && !RUSSIAN_STRONG_TITLE_PATTERN.test(title);
    if (!Number.isFinite(year) || !title || hasForeignOnlyTitle || !hasRussianContext) {
      return [];
    }
    return [{
      type: "event",
      month,
      day,
      year,
      title,
      description,
      sourceUrl,
    }];
  });
}

function parsePeople(html, month, day) {
  const blocks = html.match(/<li class="one-four birth"[\s\S]*?<\/li>/g) || [];
  return blocks.flatMap(block => {
    const yearText = cleanText(block.match(/<span class="year[^"]*">\s*([\s\S]*?)<\/span>/)?.[1] || "");
    const birthYear = Number(yearText.match(/\d{3,4}/)?.[0] || "");
    const deathText = cleanText(block.match(/<span class="year2[^"]*">\s*([\s\S]*?)<\/span>/)?.[1] || "");
    const deathYear = deathText ? Number(deathText.match(/\d{3,4}/)?.[0] || "") : null;
    const titleMatch = block.match(/<span class="title">\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<br\s*\/?>\s*<span>([\s\S]*?)<\/span>/);
    const descriptionMatch = block.match(/<p class="descr[^"]*">\s*<a[^>]+>([\s\S]*?)<\/a>/);
    const name = cleanText(titleMatch?.[2] || "");
    const summary = truncate(titleMatch?.[3] || "", 240);
    const description = truncate(descriptionMatch?.[1] || "", 320);
    const sourceUrl = absolutizeCalendUrl(titleMatch?.[1] || `/persons/${month}-${day}/`);
    const text = `${name} ${summary} ${description}`;
    if (!Number.isFinite(birthYear) || !name || BAD_PERSON_PATTERN.test(text) || !RUSSIAN_CONTEXT_PATTERN.test(text)) {
      return [];
    }
    return [{
      type: "person",
      month,
      day,
      birthYear,
      deathYear: Number.isFinite(deathYear) ? deathYear : null,
      name,
      summary,
      description,
      sourceUrl,
    }];
  });
}

function makeEventRecord(candidate, usedIds) {
  const dateKey = keyFor(candidate.month, candidate.day);
  const title = truncate(candidate.title, 170);
  const summary = truncate(`${candidate.year} год: ${title}.`, 250);
  const idSeed = candidate.sourceUrl.match(/\/events\/(\d+)\//)?.[1] || hashShort(candidate.sourceUrl || title);
  return {
    id: uniqueId(`it-event-${candidate.year}-${dateKey}-calend-ru-${idSeed}-${slugify(title)}`, usedIds),
    type: "event",
    month: candidate.month,
    day: candidate.day,
    year: candidate.year,
    titleRu: title,
    summaryRu: summary,
    descriptionRu: truncate(`${summary} Дата добавлена в ежедневный исторический календарь Focus как запись с российским или советским контекстом; ссылка ведет на календарную карточку источника.`, 620),
    primaryCountryCode: "RU",
    countryCodes: ["RU"],
    themeCodes: inferThemes(`${title} ${candidate.description}`, EVENT_THEME_RULES, ["state", "society"]),
    significance: eventScore(candidate),
    dateStatus: "exact",
    sources: [{
      id: `source-calend-event-${idSeed}`,
      titleRu: title,
      publisherRu: "Calend.ru",
      url: candidate.sourceUrl,
      sourceType: "calendar_chronology",
    }],
  };
}

function makePersonRecord(candidate, usedIds) {
  const dateKey = keyFor(candidate.month, candidate.day);
  const name = truncate(candidate.name, 150);
  const role = truncate(candidate.summary || "известный деятель российской или советской культуры, науки либо общественной жизни", 240);
  const idSeed = candidate.sourceUrl.match(/\/persons\/(\d+)\//)?.[1] || hashShort(candidate.sourceUrl || name);
  const lifeYears = candidate.deathYear ? ` Годы жизни: ${candidate.birthYear}-${candidate.deathYear}.` : "";
  return {
    id: uniqueId(`it-person-${candidate.birthYear}-${dateKey}-calend-ru-${idSeed}-${slugify(name)}`, usedIds),
    type: "person",
    month: candidate.month,
    day: candidate.day,
    birthYear: candidate.birthYear,
    deathYear: candidate.deathYear,
    nameRu: name,
    summaryRu: role,
    descriptionRu: truncate(`${name}: ${ensurePeriod(role)}${lifeYears} Дата рождения подтверждается календарной карточкой источника и используется для ежедневного блока известных людей.`, 620),
    primaryCountryCode: "RU",
    countryCodes: ["RU"],
    themeCodes: inferThemes(`${name} ${role} ${candidate.description}`, PERSON_THEME_RULES, ["culture", "society"]),
    significance: personScore(candidate),
    dateStatus: "exact",
    sources: [{
      id: `source-calend-person-${idSeed}`,
      titleRu: name,
      publisherRu: "Calend.ru",
      url: candidate.sourceUrl,
      sourceType: "calendar_biographies",
    }],
  };
}

function stringifyValue(value, indent = 4) {
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    if (typeof value[0] !== "object") {
      return `[${value.map(item => JSON.stringify(item)).join(", ")}]`;
    }
    const spaces = " ".repeat(indent);
    const innerSpaces = " ".repeat(indent + 2);
    return `[\n${value.map(item => `${spaces}{\n${Object.entries(item).map(([key, itemValue]) => `${innerSpaces}${key}: ${JSON.stringify(itemValue)},`).join("\n")}\n${spaces}}`).join(",\n")},\n${" ".repeat(indent - 2)}]`;
  }
  return JSON.stringify(value);
}

function stringifyRecord(record) {
  const lines = ["  {"];
  for (const [key, value] of Object.entries(record)) {
    lines.push(`    ${key}: ${stringifyValue(value, 6)},`);
  }
  lines.push("  }");
  return lines.join("\n");
}

function countRuForDate(catalog, month, day, type) {
  return catalog.filter(record => record.month === month && record.day === day && record.type === type && isRuRecord(record)).length;
}

function sortCandidates(candidates, scoreFn) {
  return [...candidates].sort((first, second) => scoreFn(second) - scoreFn(first)
    || normalizeComparable(first.title || first.name).localeCompare(normalizeComparable(second.title || second.name), "ru"));
}

let catalog = normalizeInterestingTodayCatalog(DEFAULT_INTERESTING_TODAY_CATALOG, { useDefaultWhenEmpty: false });
const usedIds = new Set(catalog.map(record => record.id));
const usedIdentities = new Set(catalog.map(record => recordIdentity({
  type: record.type,
  month: record.month,
  day: record.day,
  year: record.type === "event" ? record.year : record.birthYear,
  title: record.type === "event" ? record.titleRu : record.nameRu,
})));
const additions = [];
const unresolved = [];

for (const localDate of createCoverageDates()) {
  const { month, day } = partsFromDate(localDate);
  const eventDeficit = Math.max(0, MIN_RU_PER_SECTION - countRuForDate(catalog, month, day, "event"));
  const peopleDeficit = Math.max(0, MIN_RU_PER_SECTION - countRuForDate(catalog, month, day, "person"));

  if (eventDeficit > 0) {
    const candidates = sortCandidates(parseEvents(await fetchCalend("events", month, day), month, day), eventScore);
    const picked = [];
    for (const candidate of candidates) {
      const identity = recordIdentity({
        type: "event",
        month,
        day,
        year: candidate.year,
        title: candidate.title,
      });
      if (usedIdentities.has(identity)) continue;
      usedIdentities.add(identity);
      const record = makeEventRecord(candidate, usedIds);
      picked.push(record);
      if (picked.length >= eventDeficit) break;
    }
    additions.push(...picked);
    catalog = normalizeInterestingTodayCatalog([...catalog, ...picked], { useDefaultWhenEmpty: false });
    if (picked.length < eventDeficit) {
      unresolved.push({ localDate, type: "event", needed: eventDeficit, found: picked.length });
    }
  }

  if (peopleDeficit > 0) {
    const candidates = sortCandidates(parsePeople(await fetchCalend("persons", month, day), month, day), personScore);
    const picked = [];
    for (const candidate of candidates) {
      const identity = recordIdentity({
        type: "person",
        month,
        day,
        year: candidate.birthYear,
        title: candidate.name,
      });
      if (usedIdentities.has(identity)) continue;
      usedIdentities.add(identity);
      const record = makePersonRecord(candidate, usedIds);
      picked.push(record);
      if (picked.length >= peopleDeficit) break;
    }
    additions.push(...picked);
    catalog = normalizeInterestingTodayCatalog([...catalog, ...picked], { useDefaultWhenEmpty: false });
    if (picked.length < peopleDeficit) {
      unresolved.push({ localDate, type: "person", needed: peopleDeficit, found: picked.length });
    }
  }
}

if (additions.length) {
  let text = readFileSync(CATALOG_PATH, "utf8");
  text = text.replace(
    /INTERESTING_TODAY_CATALOG_VERSION = "interesting-today-ru@[^"]+"/,
    `INTERESTING_TODAY_CATALOG_VERSION = "${NEXT_VERSION}"`,
  );
  const insertionPoint = "\n];\n\nexport function normalizeInterestingTodayCatalog";
  if (!text.includes(insertionPoint)) {
    throw new Error("Catalog insertion point was not found.");
  }
  text = text.replace(
    insertionPoint,
    `\n${additions.map(stringifyRecord).join(",\n")},\n];\n\nexport function normalizeInterestingTodayCatalog`,
  );
  writeFileSync(CATALOG_PATH, text, "utf8");
}

const moduleUrl = `${pathToFileURL(process.cwd()).href}/server/interesting-today-catalog.mjs?cache=${Date.now()}`;
const updatedModule = additions.length ? await import(moduleUrl) : { DEFAULT_INTERESTING_TODAY_CATALOG };
const updatedCatalog = normalizeInterestingTodayCatalog(updatedModule.DEFAULT_INTERESTING_TODAY_CATALOG, {
  useDefaultWhenEmpty: false,
});
const remaining = createCoverageDates().flatMap(localDate => {
  const { month, day } = partsFromDate(localDate);
  const ruEvents = countRuForDate(updatedCatalog, month, day, "event");
  const ruPeople = countRuForDate(updatedCatalog, month, day, "person");
  const issues = [];
  if (ruEvents < MIN_RU_PER_SECTION) issues.push(`events:${ruEvents}`);
  if (ruPeople < MIN_RU_PER_SECTION) issues.push(`people:${ruPeople}`);
  return issues.length ? [{ localDate, issues }] : [];
});

console.log(JSON.stringify({
  version: NEXT_VERSION,
  addedRecords: additions.length,
  addedEvents: additions.filter(record => record.type === "event").length,
  addedPeople: additions.filter(record => record.type === "person").length,
  unresolved: unresolved.slice(0, 20),
  unresolvedCount: unresolved.length,
  remainingCoverageIssues: remaining.slice(0, 20),
  remainingCoverageIssueCount: remaining.length,
}, null, 2));
