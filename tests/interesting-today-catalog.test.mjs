import assert from "node:assert/strict";
import { test } from "node:test";

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
  assert.ok(report.eventCount >= 219);
  assert.ok(report.personCount >= 218);
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

test("near-term interesting today catalog covers the next seventy local dates", () => {
  const dates = [
    "2026-08-06",
    "2026-08-07",
    "2026-08-08",
    "2026-08-09",
    "2026-08-10",
    "2026-08-11",
    "2026-08-12",
    "2026-08-13",
    "2026-08-14",
    "2026-08-15",
    "2026-08-16",
    "2026-08-17",
    "2026-08-18",
    "2026-08-19",
    "2026-08-20",
    "2026-08-21",
    "2026-08-22",
    "2026-08-23",
    "2026-08-24",
    "2026-08-25",
    "2026-08-26",
    "2026-08-27",
    "2026-08-28",
    "2026-08-29",
    "2026-08-30",
    "2026-08-31",
    "2026-09-01",
    "2026-09-02",
    "2026-09-03",
    "2026-09-04",
    "2026-09-05",
    "2026-09-06",
    "2026-09-07",
    "2026-09-08",
    "2026-09-09",
    "2026-09-10",
    "2026-09-11",
    "2026-09-12",
    "2026-09-13",
    "2026-09-14",
    "2026-09-15",
    "2026-09-16",
    "2026-09-17",
    "2026-09-18",
    "2026-09-19",
    "2026-09-20",
    "2026-09-21",
    "2026-09-22",
    "2026-09-23",
    "2026-09-24",
    "2026-09-25",
    "2026-09-26",
    "2026-09-27",
    "2026-09-28",
    "2026-09-29",
    "2026-09-30",
    "2026-10-01",
    "2026-10-02",
    "2026-10-03",
    "2026-10-04",
    "2026-10-05",
    "2026-10-06",
    "2026-10-07",
    "2026-10-08",
    "2026-10-09",
    "2026-10-10",
    "2026-10-11",
    "2026-10-12",
    "2026-10-13",
    "2026-10-14",
  ];

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
