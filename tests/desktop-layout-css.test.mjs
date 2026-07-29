import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const appCss = readFileSync("public/css/app.css", "utf8");
const tokenCss = readFileSync("public/css/tokens.css", "utf8");
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
  assert.match(serviceWorker, /focus-pwa-v74/);
});

test("warm glass summary keeps text contrast above the seasonal background", () => {
  assert.match(tokenCss, /--text:\s*#1f1a16;/);
  assert.match(tokenCss, /--text-soft:\s*#342d27;/);
  assert.match(tokenCss, /--text-muted:\s*#4c433a;/);
  assert.match(tokenCss, /--glass-1:\s*rgba\(255,\s*252,\s*244,\s*\.34\);/);
  assert.match(tokenCss, /--glass-strong:\s*rgba\(255,\s*252,\s*244,\s*\.64\);/);
  assert.match(appCss, /\.summary-card,\s*\.tasks-card\s*{[\s\S]*?rgba\(255,\s*252,\s*244,\s*\.52\)[\s\S]*?border-color:\s*rgba\(255,\s*255,\s*255,\s*\.66\);/);
  assert.match(appCss, /\.summary-title\s*{[\s\S]*?color:\s*color-mix\(in srgb,\s*var\(--summary-color,\s*var\(--text\)\),\s*#1f1a16 42%\);/);
  assert.match(appCss, /\.day-card-event\s*{[\s\S]*?--event-readable-color:\s*color-mix\(in srgb,\s*var\(--event-color\),\s*#1f1a16 42%\);[\s\S]*?border:\s*1px solid rgba\(255,\s*255,\s*255,\s*\.66\);/);
  assert.match(appCss, /\.day-card-event strong\s*{[\s\S]*?color:\s*var\(--event-readable-color\);/);
  assert.match(appCss, /\.day-card-event small\s*{[\s\S]*?color:\s*#4c433a;[\s\S]*?font-weight:\s*720;/);
  assert.match(appCss, /\.summary-time\s*{[\s\S]*?color:\s*#332c27;/);
  assert.match(appCss, /\.day-card-event__time\s*{[\s\S]*?color:\s*#332c27;/);
  assert.match(appCss, /\.summary-item\s*{[\s\S]*?border:\s*1px solid rgba\(255,\s*255,\s*255,\s*\.62\);[\s\S]*?rgba\(255,\s*252,\s*244,\s*\.54\)/);
  assert.match(readFileSync("public/js/app.js", "utf8"), /class="summary-title" style="--summary-color:\$\{item\.color\}"/);
});
