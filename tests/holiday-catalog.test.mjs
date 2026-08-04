import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getHolidayDateStatusMessage,
  getHolidayCatalogVersion,
  getPublishedHolidayCatalog,
  normalizeHolidayPreferences,
  normalizeHolidayReligiousPreferences,
  selectHolidayEvents,
  validateHolidayCatalog,
  validateHolidayPreferences,
} from "../public/js/holiday-catalog.js";

const catalog = getPublishedHolidayCatalog({ countryCode: "RU", year: 2026 });

test("bundled RU 2026 holiday catalog is valid and versioned", () => {
  const validation = validateHolidayCatalog(catalog, { targetStatus: "published" });
  const version = getHolidayCatalogVersion({ countryCode: "RU", year: 2026 });

  assert.equal(validation.ok, true);
  assert.equal(catalog.status, "published");
  assert.equal(version.status, "published");
  assert.equal(version.checksum, catalog.checksum);
  assert.match(version.checksum, /^fnv1a-[0-9a-f]{8}$/);
});

test("public holidays include 2026 official day-off transfers when enabled", () => {
  const events = selectHolidayEvents({
    catalog,
    preferences: normalizeHolidayPreferences({
      publicHolidaysEnabled: true,
      workingDayOverridesEnabled: true,
    }),
    religiousPreferences: normalizeHolidayReligiousPreferences(),
    date: "2026-01-09",
  });

  assert.ok(events.some(event => event.id === "ru-2026-public-day-off-jan-09"));

  const marchEvents = selectHolidayEvents({
    catalog,
    preferences: normalizeHolidayPreferences({
      publicHolidaysEnabled: true,
      workingDayOverridesEnabled: true,
    }),
    religiousPreferences: normalizeHolidayReligiousPreferences(),
    date: "2026-03-09",
  });
  assert.ok(marchEvents.some(event => event.id === "ru-2026-public-day-off-mar-09"));

  const mayEvents = selectHolidayEvents({
    catalog,
    preferences: normalizeHolidayPreferences({
      publicHolidaysEnabled: true,
      workingDayOverridesEnabled: true,
    }),
    religiousPreferences: normalizeHolidayReligiousPreferences(),
    date: "2026-05-11",
  });
  assert.ok(mayEvents.some(event => event.id === "ru-2026-public-day-off-may-11"));

  const disabled = selectHolidayEvents({
    catalog,
    preferences: normalizeHolidayPreferences({
      publicHolidaysEnabled: false,
      workingDayOverridesEnabled: true,
    }),
    religiousPreferences: normalizeHolidayReligiousPreferences(),
    date: "2026-01-09",
  });

  assert.ok(!disabled.some(event => event.id === "ru-2026-public-day-off-jan-09"));
});

test("professional holidays support none, all, and selected category modes", () => {
  const none = selectHolidayEvents({
    catalog,
    preferences: normalizeHolidayPreferences({ professionalMode: "none" }),
    religiousPreferences: normalizeHolidayReligiousPreferences(),
    date: "2026-09-13",
  });
  assert.ok(!none.some(event => event.id === "ru-2026-prof-programmer"));

  const all = selectHolidayEvents({
    catalog,
    preferences: normalizeHolidayPreferences({ professionalMode: "all" }),
    religiousPreferences: normalizeHolidayReligiousPreferences(),
    date: "2026-09-13",
  });
  assert.ok(all.some(event => event.id === "ru-2026-prof-programmer"));

  const selected = selectHolidayEvents({
    catalog,
    preferences: normalizeHolidayPreferences({
      professionalMode: "selected",
      professionalCategoryCodes: ["it_telecom"],
    }),
    religiousPreferences: normalizeHolidayReligiousPreferences(),
    date: "2026-09-13",
  });
  assert.ok(selected.some(event => event.id === "ru-2026-prof-programmer"));

  const unrelated = selectHolidayEvents({
    catalog,
    preferences: normalizeHolidayPreferences({
      professionalMode: "selected",
      professionalCategoryCodes: ["law"],
    }),
    religiousPreferences: normalizeHolidayReligiousPreferences(),
    date: "2026-09-13",
  });
  assert.ok(!unrelated.some(event => event.id === "ru-2026-prof-programmer"));
});

test("multiple religious calendars can be selected locally", () => {
  const events = selectHolidayEvents({
    catalog,
    preferences: normalizeHolidayPreferences({ publicHolidaysEnabled: false }),
    religiousPreferences: normalizeHolidayReligiousPreferences({
      selectedTraditions: ["orthodox", "catholic"],
    }),
    date: "2026-04-05",
  });

  assert.deepEqual(events.map(event => event.religiousTradition).sort(), ["catholic", "orthodox"]);
  assert.ok(events.some(event => event.id === "ru-2026-orthodox-palm-sunday"));
  assert.ok(events.some(event => event.id === "ru-2026-catholic-easter"));
});

test("preliminary Islamic dates carry an uncertainty message", () => {
  const events = selectHolidayEvents({
    catalog,
    preferences: normalizeHolidayPreferences({ publicHolidaysEnabled: false }),
    religiousPreferences: normalizeHolidayReligiousPreferences({
      selectedTraditions: ["islamic"],
    }),
    date: "2026-01-16",
  });
  const event = events.find(item => item.id === "ru-2026-islamic-isra-miraj");

  assert.equal(event.dateStatus, "preliminary");
  assert.match(getHolidayDateStatusMessage(event), /уточнена/);
});

test("system holiday duplicates are merged without swallowing user events", () => {
  const events = selectHolidayEvents({
    catalog,
    preferences: normalizeHolidayPreferences({
      publicHolidaysEnabled: true,
      workingDayOverridesEnabled: true,
    }),
    religiousPreferences: normalizeHolidayReligiousPreferences({
      selectedTraditions: ["orthodox"],
    }),
    date: "2026-01-07",
    userEvents: [{
      id: "user-christmas-note",
      title: "Рождество Христово",
      startLocalDate: "2026-01-07",
    }],
  });

  const systemChristmasEvents = events.filter(event => event.isSystemEvent && event.title === "Рождество Христово");
  assert.equal(systemChristmasEvents.length, 1);
  assert.ok(events.some(event => event.id === "user-christmas-note"));
});

test("merged system holiday duplicates preserve all calendar status metadata", () => {
  const events = selectHolidayEvents({
    catalog,
    preferences: normalizeHolidayPreferences({
      publicHolidaysEnabled: true,
      workingDayOverridesEnabled: true,
    }),
    religiousPreferences: normalizeHolidayReligiousPreferences({
      selectedTraditions: ["orthodox"],
    }),
    date: "2026-01-07",
  });
  const christmas = events.find(event => event.id === "ru-2026-public-christmas");

  assert.equal(christmas.isOfficialNonWorkingDay, true);
  assert.deepEqual(christmas.mergedEventTypes.sort(), ["public_holiday", "religious_holiday"]);
  assert.deepEqual(christmas.mergedCalendarKinds.sort(), ["public", "religious"]);
  assert.deepEqual(christmas.mergedReligiousTraditions, ["orthodox"]);
});

test("server holiday preferences validation does not carry religious fields", () => {
  const validation = validateHolidayPreferences({
    countryCode: "RU",
    publicHolidaysEnabled: true,
    selectedTraditions: ["islamic"],
    religiousTraditions: ["orthodox"],
    hiddenCalendarIds: ["holiday-calendar-ru-2026-public"],
  });

  assert.equal(validation.ok, true);
  assert.equal(Object.hasOwn(validation.preferences, "selectedTraditions"), false);
  assert.equal(Object.hasOwn(validation.preferences, "religiousTraditions"), false);
  assert.deepEqual(validation.preferences.hiddenCalendarIds, ["holiday-calendar-ru-2026-public"]);
});
