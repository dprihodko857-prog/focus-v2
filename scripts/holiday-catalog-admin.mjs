import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  getPublishedHolidayCatalog,
  importHolidayCatalogToStaging,
  validateHolidayCatalog,
} from "../public/js/holiday-catalog.js";

const [command = "validate", inputPath = "", ...flags] = process.argv.slice(2);
const targetFlag = flags.find(flag => flag.startsWith("--target="));
const expectedStatus = targetFlag ? targetFlag.slice("--target=".length) : "approved";
const catalog = inputPath ? readCatalogFile(inputPath) : getPublishedHolidayCatalog({ countryCode: "RU", year: 2026 });

if (!catalog) {
  printJson({ ok: false, error: "holiday_catalog_not_found" });
  process.exitCode = 1;
} else if (command === "validate") {
  const validation = validateHolidayCatalog(catalog, { targetStatus: catalog.status === "published" ? "published" : "approved" });
  printJson(validation);
  process.exitCode = validation.ok ? 0 : 1;
} else if (command === "dry-run") {
  const report = importHolidayCatalogToStaging(catalog, { dryRun: true, expectedStatus });
  printJson(report);
  process.exitCode = report.validation.ok ? 0 : 1;
} else {
  printJson({
    ok: false,
    error: "unknown_command",
    usage: "node scripts/holiday-catalog-admin.mjs validate [catalog.json] | dry-run [catalog.json] [--target=approved|published]",
  });
  process.exitCode = 1;
}

function readCatalogFile(filePath) {
  return JSON.parse(readFileSync(resolve(filePath), "utf8"));
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
