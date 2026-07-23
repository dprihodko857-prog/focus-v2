import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const appCss = readFileSync("public/css/app.css", "utf8");
const indexHtml = readFileSync("public/index.html", "utf8");
const serviceWorker = readFileSync("public/service-worker.js", "utf8");

test("desktop dashboard keeps sections compact without squeezing today's tasks", () => {
  assert.match(appCss, /\.app-shell\s*{[\s\S]*?align-content:\s*start;/);
  assert.match(appCss, /\.main-stack\s*{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/);
  assert.match(appCss, /\.calendar-card\s*{[\s\S]*?grid-column:\s*1;[\s\S]*?width:\s*100%;/);
  assert.match(appCss, /\.labels-row\s*{[\s\S]*?grid-column:\s*1;[\s\S]*?width:\s*100%;/);
  assert.match(appCss, /\.interesting\s*{[\s\S]*?grid-column:\s*1;[\s\S]*?width:\s*100%;/);
  assert.match(appCss, /\.sidebar\s*{[\s\S]*?grid-row:\s*1 \/ 3;/);
  assert.match(appCss, /\.side-stack\s*{[\s\S]*?grid-row:\s*2;/);
  assert.match(appCss, /\.side-stack\s*{[\s\S]*?grid-template-rows:\s*auto minmax\(220px, 1fr\);/);
  assert.match(appCss, /\.tasks-card\s*{[\s\S]*?min-height:\s*220px;/);
  assert.match(indexHtml, /<div class="main-stack">[\s\S]*?<section class="labels-row[\s\S]*?<section class="interesting glass-panel">[\s\S]*?<\/div>\s*<aside class="side-stack">/);
  assert.match(indexHtml, /<section class="interesting glass-panel interesting--legacy" hidden>/);
  assert.doesNotMatch(appCss, /max-height:\s*calc\(100vh - 124px\)/);
});

test("service worker cache is bumped after desktop layout CSS changes", () => {
  assert.match(serviceWorker, /focus-pwa-v46/);
});
