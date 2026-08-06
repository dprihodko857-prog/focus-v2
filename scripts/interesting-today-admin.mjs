#!/usr/bin/env node
import { readFileSync } from "node:fs";
import {
  DEFAULT_INTERESTING_TODAY_CATALOG,
  createInterestingTodayCatalogReport,
  createInterestingTodayDryRun,
  normalizeInterestingTodayCatalog,
} from "../server/interesting-today-catalog.mjs";

const [command = "summary", filePath = ""] = process.argv.slice(2);

function readCandidates(path) {
  if (!path) {
    return DEFAULT_INTERESTING_TODAY_CATALOG;
  }

  const parsed = JSON.parse(readFileSync(path, "utf8"));
  return Array.isArray(parsed) ? parsed : parsed.candidates || parsed.records || [];
}

if (command === "summary") {
  const catalog = readCandidates(filePath);
  console.log(JSON.stringify(createInterestingTodayCatalogReport(catalog), null, 2));
} else if (command === "validate") {
  const catalog = normalizeInterestingTodayCatalog(readCandidates(filePath), { useDefaultWhenEmpty: false });
  const report = createInterestingTodayCatalogReport(catalog);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ok ? 0 : 1;
} else if (command === "dry-run") {
  const dryRun = createInterestingTodayDryRun(readCandidates(filePath), {
    target: process.argv.includes("--target=approved") ? "approved" : "staging",
  });
  console.log(JSON.stringify(dryRun, null, 2));
} else {
  console.error("Usage: node scripts/interesting-today-admin.mjs summary|validate|dry-run [catalog.json] [--target=approved]");
  process.exitCode = 1;
}
