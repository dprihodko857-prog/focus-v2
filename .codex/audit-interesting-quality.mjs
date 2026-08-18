import {
  DEFAULT_INTERESTING_TODAY_CATALOG,
  createInterestingTodayCatalogReport,
  isInterestingTodayEligibleForProduction,
  normalizeInterestingTodayCatalog,
  selectInterestingTodayRecords,
} from "../server/interesting-today-catalog.mjs";
import { writeFileSync } from "node:fs";

const catalog = normalizeInterestingTodayCatalog(DEFAULT_INTERESTING_TODAY_CATALOG, {
  useDefaultWhenEmpty: false,
});
const eligible = catalog.filter(isInterestingTodayEligibleForProduction);

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

function textOf(record) {
  return [
    record.titleRu,
    record.nameRu,
    record.summaryRu,
    record.descriptionRu,
  ].filter(Boolean).join(" ");
}

function sourceText(source) {
  return [
    source.titleRu,
    source.title,
    source.publisherRu,
    source.publisher,
    source.url,
  ].filter(Boolean).join(" ");
}

function isYearWikiSource(source) {
  let parsed = null;
  try {
    parsed = new URL(source.url);
  } catch {
    return true;
  }

  const title = String(source.titleRu || source.title || "").trim();
  const pathname = decodeURIComponent(parsed.pathname);
  return /wikipedia\.org$/i.test(parsed.hostname) && (
    /^\d{1,4}\s+\u0433\u043e\u0434$/iu.test(title) ||
    /^\/wiki\/\d{1,4}_\u0433\u043e\u0434$/iu.test(pathname)
  );
}

function isGenericText(record) {
  const text = textOf(record);
  return [
    "\u0417\u0430\u043f\u0438\u0441\u044c \u0441\u043d\u0430\u0431\u0436\u0435\u043d\u0430",
    "\u0421\u043e\u0431\u044b\u0442\u0438\u0435 \u0432\u043a\u043b\u044e\u0447\u0435\u043d\u043e",
    "\u0411\u0438\u043e\u0433\u0440\u0430\u0444\u0438\u044f \u0432\u043a\u043b\u044e\u0447\u0435\u043d\u0430",
    "\u0441\u043f\u0440\u0430\u0432\u043e\u0447\u043d\u044b\u043c \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u043e\u043c",
  ].some(fragment => text.includes(fragment));
}

function summarizeRecord(record) {
  return {
    id: record.id,
    type: record.type,
    date: `${String(record.month).padStart(2, "0")}-${String(record.day).padStart(2, "0")}`,
    year: record.type === "event" ? record.year : record.birthYear,
    title: record.type === "event" ? record.titleRu : record.nameRu,
    country: record.primaryCountryCode,
    sources: record.sources.map(source => source.url).slice(0, 2),
  };
}

function countBy(items, getKey) {
  const counts = new Map();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]));
}

function repeatedValues(getValue, minCount = 2) {
  const groups = new Map();
  for (const record of eligible) {
    const value = String(getValue(record) || "").trim();
    if (!value) continue;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(record);
  }
  return [...groups.entries()]
    .filter(([, records]) => records.length >= minCount)
    .sort((first, second) => second[1].length - first[1].length)
    .map(([value, records]) => ({
      count: records.length,
      value,
      examples: records.slice(0, 3).map(summarizeRecord),
    }));
}

const genericTextRecords = eligible.filter(isGenericText);
const shortDescriptionRecords = eligible.filter(record => String(record.descriptionRu || "").length < 90);
const yearWikiOnlyRecords = eligible.filter(record => record.sources.length > 0 && record.sources.every(isYearWikiSource));
const worldPrimaryRecords = eligible.filter(record => record.primaryCountryCode === "WORLD");
const noSourceRecords = eligible.filter(record => !record.sources.length);
const sourceHosts = countBy(eligible.flatMap(record => record.sources), source => {
  try {
    return new URL(source.url).hostname.replace(/^www\./, "");
  } catch {
    return "invalid-url";
  }
}).slice(0, 20);

const dates = createCoverageDates();
const weakSelections = dates.flatMap(localDate => {
  const selection = selectInterestingTodayRecords({
    catalog,
    countryCode: "RU",
    language: "ru",
    localDate,
  });
  const topEvents = selection.events.slice(0, 3);
  const topPeople = selection.people.slice(0, 3);
  const issues = [];

  if (selection.availableEvents < 3) issues.push("few-events");
  if (selection.availablePeople < 3) issues.push("few-people");
  if (topEvents.slice(0, 2).filter(record => record.countryCodes.includes("RU")).length < 2) issues.push("not-ru-led-events");
  if (topPeople.slice(0, 2).filter(record => record.countryCodes.includes("RU")).length < 2) issues.push("not-ru-led-people");
  if (topEvents.filter(record => record.primaryCountryCode === "US").length > 1) issues.push("us-heavy-events");
  if (topPeople.filter(record => record.primaryCountryCode === "US").length > 1) issues.push("us-heavy-people");
  if (topEvents.some(record => record.primaryCountryCode === "WORLD")) issues.push("world-leading-event");
  if (topPeople.some(record => record.primaryCountryCode === "WORLD")) issues.push("world-leading-person");
  if ([...topEvents, ...topPeople].some(isGenericText)) issues.push("generic-leading-text");
  if ([...topEvents, ...topPeople].some(record => record.sources.every(isYearWikiSource))) issues.push("weak-leading-source");

  return issues.length
    ? [{
      localDate,
      issues,
      events: topEvents.map(summarizeRecord),
      people: topPeople.map(summarizeRecord),
    }]
    : [];
});

const result = {
  report: createInterestingTodayCatalogReport(DEFAULT_INTERESTING_TODAY_CATALOG, {
    checkedAt: new Date().toISOString(),
  }),
  quality: {
    eligibleRecords: eligible.length,
    genericTextCount: genericTextRecords.length,
    shortDescriptionCount: shortDescriptionRecords.length,
    yearWikiOnlyCount: yearWikiOnlyRecords.length,
    worldPrimaryCount: worldPrimaryRecords.length,
    noSourceCount: noSourceRecords.length,
    weakSelectionDateCount: weakSelections.length,
  },
  examples: {
    genericText: genericTextRecords.slice(0, 8).map(summarizeRecord),
    shortDescriptions: shortDescriptionRecords.slice(0, 8).map(summarizeRecord),
    yearWikiOnly: yearWikiOnlyRecords.slice(0, 8).map(summarizeRecord),
    worldPrimary: worldPrimaryRecords.slice(0, 8).map(summarizeRecord),
    weakSelections: weakSelections.slice(0, 10),
    repeatedDescriptions: repeatedValues(record => record.descriptionRu, 3).slice(0, 5),
    repeatedSummaries: repeatedValues(record => record.summaryRu, 3).slice(0, 5),
    sourceHosts,
  },
};

writeFileSync(".codex/interesting-quality-audit.json", `${JSON.stringify(result, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  report: result.report,
  quality: result.quality,
  topSourceHosts: result.examples.sourceHosts.slice(0, 8),
  firstWeakSelections: result.examples.weakSelections.slice(0, 3).map(item => ({
    localDate: item.localDate,
    issues: item.issues,
  })),
}, null, 2));
