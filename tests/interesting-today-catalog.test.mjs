import assert from "node:assert/strict";
import { test } from "node:test";

function createFullInterestingTodayCoverageDates() {
  const dates = [];
  const start = new Date(Date.UTC(2026, 7, 5));
  const end = new Date(Date.UTC(2027, 7, 4));
  for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    dates.push(date.toISOString().slice(0, 10));
  }
  dates.push("2028-02-29");
  return dates;
}

import {
  DEFAULT_INTERESTING_TODAY_CATALOG,
  createInterestingTodayCatalogReport,
  createInterestingTodayDryRun,
  normalizeInterestingTodayCatalog,
  selectInterestingTodayRecords,
} from "../server/interesting-today-catalog.mjs";

test("default interesting today catalog is production eligible and source backed", () => {
  const catalog = normalizeInterestingTodayCatalog(DEFAULT_INTERESTING_TODAY_CATALOG);
  const report = createInterestingTodayCatalogReport(catalog, {
    checkedAt: "2026-08-05T00:00:00.000Z",
  });

  assert.equal(report.ok, true);
  assert.equal(report.fixtureIds.length, 0);
  assert.ok(report.eventCount >= 1121);
  assert.ok(report.personCount >= 1137);
  assert.ok(report.sourceCount >= report.eligibleRecordCount);
});

test("daily interesting today selection is date and country aware", () => {
  const selection = selectInterestingTodayRecords({
    catalog: DEFAULT_INTERESTING_TODAY_CATALOG,
    countryCode: "RU",
    language: "ru",
    localDate: "2026-08-05",
  });

  assert.equal(selection.localDate, "2026-08-05");
  assert.equal(selection.countryCode, "RU");
  assert.equal(selection.events.length, 5);
  assert.equal(selection.availableEvents, 5);
  assert.equal(selection.events[0].id, "it-event-1963-08-05-test-ban-treaty");
  assert.ok(selection.events.some(event => event.id === "it-event-1943-08-05-orel-belgorod-liberated"));
  assert.ok(selection.events.some(event => event.id === "it-event-1858-08-05-first-transatlantic-cable"));
  assert.ok(selection.events.some(event => event.id === "it-event-1962-08-05-nelson-mandela-arrested"));
  assert.ok(selection.events.some(event => event.id === "it-event-2010-08-05-san-jose-mine-collapse"));
  assert.equal(selection.people[0].id, "it-person-1844-08-05-ilya-repin");
  assert.ok(selection.people.some(person => person.id === "it-person-1930-08-05-neil-armstrong"));
});

test("russian audience selection leads with local records when available", () => {
  const selection = selectInterestingTodayRecords({
    catalog: DEFAULT_INTERESTING_TODAY_CATALOG,
    countryCode: "RU",
    language: "ru",
    localDate: "2026-08-18",
  });

  const compactEvents = selection.events.slice(0, 2);
  const compactPeople = selection.people.slice(0, 2);

  assert.equal(compactEvents.length, 2);
  assert.equal(compactPeople.length, 2);
  assert.ok(compactEvents.every(event => event.countryCodes.includes("RU")));
  assert.ok(compactPeople.every(person => person.primaryCountryCode === "RU"));
  assert.ok(selection.events.some(event => event.id === "it-event-1845-08-18-russian-geographical-society-founded"));
  assert.ok(selection.people.some(person => person.id === "it-person-1921-08-18-lidiya-litvyak"));
});

test("near-term interesting today catalog covers configured local dates", () => {
  const dates = createFullInterestingTodayCoverageDates();

  dates.forEach(localDate => {
    const selection = selectInterestingTodayRecords({
      catalog: DEFAULT_INTERESTING_TODAY_CATALOG,
      countryCode: "RU",
      language: "ru",
      localDate,
    });

    assert.ok(selection.availableEvents >= 3, `${localDate} should have at least 3 events`);
    assert.ok(selection.availablePeople >= 3, `${localDate} should have at least 3 people`);
    assert.ok(selection.events.every(event => event.sources.length > 0));
    assert.ok(selection.people.every(person => person.sources.length > 0));
  });
});

test("nearest interesting today selections use concrete country badges", () => {
  const dates = createFullInterestingTodayCoverageDates();

  dates.forEach(localDate => {
    const selection = selectInterestingTodayRecords({
      catalog: DEFAULT_INTERESTING_TODAY_CATALOG,
      countryCode: "RU",
      language: "ru",
      localDate,
    });

    const leadingEvents = selection.events.slice(0, 3);
    const leadingPeople = selection.people.slice(0, 3);
    const compactEvents = selection.events.slice(0, 2);
    const compactPeople = selection.people.slice(0, 2);

    assert.ok(leadingEvents.every(event => event.primaryCountryCode !== "WORLD"), `${localDate} events should have concrete primary countries`);
    assert.ok(leadingPeople.every(person => person.primaryCountryCode !== "WORLD"), `${localDate} people should have concrete primary countries`);
    assert.ok(leadingEvents.filter(event => event.primaryCountryCode === "US").length <= 1, `${localDate} leading events should not be US-heavy`);
    assert.ok(leadingPeople.filter(person => person.primaryCountryCode === "US").length <= 1, `${localDate} leading people should not be US-heavy`);
    assert.ok(compactEvents.filter(event => event.countryCodes.includes("RU")).length >= 2, `${localDate} compact events should be led by Russian-context records`);
    assert.ok(compactPeople.filter(person => person.countryCodes.includes("RU")).length >= 2, `${localDate} compact people should be led by Russian-context records`);
  });
});

test("foreign-only records are not tagged as Russian context", () => {
  const catalog = normalizeInterestingTodayCatalog(DEFAULT_INTERESTING_TODAY_CATALOG);
  const recordsById = new Map(catalog.map(record => [record.id, record]));
  const foreignOnlyIds = [
    "it-event-1863-01-10-calend-ru-4196-v-londone-otkrylas-pervaya-v-mire-liniya-metro",
    "it-event-1999-09-24-calend-ru-5299-v-londone-na-bei-ker-strit-otkryt-pamyatnik-sherloku-kholmsu",
    "it-person-1792-02-29-dzhoakkino-rossini-um-1868",
  ];

  foreignOnlyIds.forEach(id => {
    const record = recordsById.get(id);
    assert.ok(record, `${id} should exist`);
    assert.equal(record.countryCodes.includes("RU"), false, `${id} should not use the RU badge`);
    assert.notEqual(record.primaryCountryCode, "RU", `${id} should not use RU as primary country`);
  });
});

test("interesting today dry-run keeps invalid candidates out of staging output", () => {
  const dryRun = createInterestingTodayDryRun([
    {
      id: "fixture-invalid",
      type: "event",
      month: 8,
      day: 5,
      titleRu: "No source",
      summaryRu: "Missing source",
      descriptionRu: "Missing source",
      themeCodes: ["state"],
    },
  ], {
    createId: () => "interesting-import-test",
    checkedAt: "2026-08-05T00:00:00.000Z",
  });

  assert.equal(dryRun.batch.candidateCount, 1);
  assert.equal(dryRun.batch.rejectedCount, 1);
  assert.deepEqual(dryRun.candidates, []);
  assert.deepEqual(dryRun.validationResults[0].errors, ["invalid_candidate"]);
});
