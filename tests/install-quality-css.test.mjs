import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const indexHtml = readFileSync("public/index.html", "utf8");
const tokensCss = readFileSync("public/css/tokens.css", "utf8");
const appCss = readFileSync("public/css/app.css", "utf8");
const appJs = readFileSync("public/js/app.js", "utf8");
const pwaJs = readFileSync("public/js/pwa.js", "utf8");
const manifest = readFileSync("public/manifest.webmanifest", "utf8");
const serviceWorker = readFileSync("public/service-worker.js", "utf8");
const logoGenerator = readFileSync("scripts/generate-focus-logo-assets.mjs", "utf8");
const manifestJson = JSON.parse(manifest);

test("mobile viewport supports installed PWA safe areas", () => {
  assert.match(indexHtml, /viewport-fit=cover/);
  assert.match(indexHtml, /minimum-scale=1/);
  assert.match(indexHtml, /maximum-scale=1/);
  assert.match(indexHtml, /user-scalable=no/);
  assert.match(tokensCss, /scrollbar-width:\s*none/);
  assert.match(tokensCss, /-ms-overflow-style:\s*none/);
  assert.match(tokensCss, /html::-webkit-scrollbar,\s*body::-webkit-scrollbar/);
  assert.match(tokensCss, /touch-action:\s*pan-x pan-y/);
  assert.match(appJs, /function lockViewportScale/);
  assert.match(appJs, /gesturestart/);
  assert.match(appJs, /touchmove/);
  assert.match(appJs, /event\.touches\?\.length > 1/);
});

test("mobile bottom navigation has safe-area spacing and an opaque surface", () => {
  assert.match(appCss, /padding-bottom:\s*calc\(120px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(appCss, /bottom:\s*max\(12px, env\(safe-area-inset-bottom\)\)/);
  assert.match(appCss, /background:\s*rgba\(31,\s*41,\s*55,\s*\.9\)/);
  assert.match(appCss, /grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)/);
  assert.doesNotMatch(appCss, /\.sidebar__nav \.nav-item:nth-child\(n\+6\)/);
  assert.doesNotMatch(indexHtml, /aria-label="Фокус"[\s\S]*?icon-home/);
  assert.doesNotMatch(appCss, /\.icon-home/);
});

test("focus brand assets use the current target mark", () => {
  assert.match(indexHtml, /<link rel="manifest" href="\/manifest\.webmanifest\?v=focus-logo-v2" \/>/);
  assert.match(indexHtml, /href="\/assets\/icons\/favicon-v2-32\.png"/);
  assert.match(indexHtml, /href="\/assets\/icons\/apple-touch-icon-v2\.png"/);
  assert.match(appCss, /background:\s*#10151e url\("\/assets\/focus-logo-v2\.png"\) center\/100% 100% no-repeat;/);
  assert.match(manifest, /"src": "\/assets\/icons\/icon-v2-1024\.png"[\s\S]*?"sizes": "1024x1024"/);
  assert.match(serviceWorker, /"\/manifest\.webmanifest\?v=focus-logo-v2"/);
  assert.match(serviceWorker, /"\/assets\/icons\/favicon-v2-32\.png"/);
  assert.match(serviceWorker, /"\/assets\/icons\/apple-touch-icon-v2\.png"/);
  assert.doesNotMatch(indexHtml, /href="\/assets\/icons\/favicon-32\.png"/);
  assert.doesNotMatch(indexHtml, /href="\/assets\/icons\/apple-touch-icon\.png"/);
  assert.doesNotMatch(manifest, /"src": "\/assets\/icons\/icon-192\.png"/);
  assert.match(logoGenerator, /drawMark/);
  assert.match(logoGenerator, /#F97316/);
  assert.match(logoGenerator, /#374151/);
  assert.deepEqual(readPngSize("public/assets/focus-logo-v2.png"), { width: 128, height: 128 });
  assert.deepEqual(readPngSize("public/assets/brand/focus-app-icon-reference-v2.png"), { width: 1024, height: 1024 });
  assert.deepEqual(readPngSize("public/assets/icons/favicon-v2-32.png"), { width: 32, height: 32 });
});

test("seasonal month backgrounds use high resolution webp assets", () => {
  [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ].forEach(month => {
    const path = `public/assets/months/large/${month}.webp`;
    assert.deepEqual(readWebpSize(path), { width: 1672, height: 941 });
    assert.match(serviceWorker, new RegExp(`"/assets/months/large/${month}\\.webp"`));
  });
});

test("desktop app switches to mobile chrome in compact windows", () => {
  assert.match(appJs, /const COMPACT_WINDOW_WIDTH = 1720;/);
  assert.match(appJs, /const RESTORED_WINDOW_TOLERANCE = 24;/);
  assert.match(appJs, /function syncCompactWindowMode/);
  assert.match(appJs, /isRestoredDesktopWindow/);
  assert.match(appJs, /app-shell--compact-window/);
  assert.match(appJs, /dataset\.windowMode/);
  assert.match(appCss, /@media \(min-width:\s*761px\) and \(max-width:\s*1720px\)/);
  assert.match(appCss, /@media \(min-width:\s*761px\) and \(max-width:\s*1720px\)[\s\S]*?\.app-shell\s*{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*min\(100%,\s*960px\)\)\s*!important;/);
  assert.match(appCss, /\.app-shell\.app-shell--compact-window\s*{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*min\(100%,\s*960px\)\)\s*!important;/);
  assert.match(appCss, /\.app-shell\.app-shell--compact-window \.sidebar\s*{[\s\S]*?position:\s*fixed\s*!important;[\s\S]*?bottom:\s*max\(12px,\s*env\(safe-area-inset-bottom\)\)\s*!important;/);
  assert.match(appCss, /\.app-shell\.app-shell--compact-window \.sidebar__nav\s*{[\s\S]*?grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)\s*!important;/);
  assert.match(appCss, /\.app-shell\.app-shell--compact-window \.dashboard-grid,\s*\.app-shell\.app-shell--compact-window \.main-stack,\s*\.app-shell\.app-shell--compact-window \.side-stack\s*{[\s\S]*?display:\s*contents\s*!important;/);
});

test("iphone layout resets desktop grid positions into one mobile column", () => {
  assert.match(appCss, /@media \(max-width:\s*760px\)\s*{[\s\S]*?\.app-shell\s*{[\s\S]*?display:\s*grid;/);
  assert.match(appCss, /\.top-dock,\s*\.dashboard-grid,\s*\.main-stack,\s*\.side-stack,\s*\.interesting\s*{[\s\S]*?grid-column:\s*1;[\s\S]*?grid-row:\s*auto;[\s\S]*?width:\s*100%;/);
  assert.match(appCss, /@media \(max-width:\s*760px\)[\s\S]*?\.dashboard-grid\s*{[\s\S]*?display:\s*contents;/);
  assert.match(appCss, /@media \(max-width:\s*760px\)[\s\S]*?\.calendar-card\s*{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;/);
  assert.match(appCss, /min-height:\s*clamp\(42px,\s*11\.2vw,\s*54px\)/);
  assert.match(appCss, /@media \(max-width:\s*760px\)[\s\S]*?\.labels-row\s*{[\s\S]*?margin-bottom:\s*96px;/);
});

test("ios install experience includes startup images and full app icon master", () => {
  const splashImages = [
    ["iphone-8-portrait.png", 750, 1334],
    ["iphone-11-portrait.png", 828, 1792],
    ["iphone-12-mini-portrait.png", 1080, 2340],
    ["iphone-14-portrait.png", 1170, 2532],
    ["iphone-15-pro-portrait.png", 1179, 2556],
    ["iphone-15-pro-max-portrait.png", 1290, 2796],
    ["ipad-pro-11-portrait.png", 1668, 2388],
    ["ipad-pro-12-portrait.png", 2048, 2732],
  ];

  assert.match(manifest, /"src": "\/assets\/icons\/icon-v2-1024\.png"[\s\S]*?"sizes": "1024x1024"/);
  assert.match(serviceWorker, /"\/assets\/icons\/icon-v2-1024\.png"/);

  splashImages.forEach(([name, width, height]) => {
    const path = `public/assets/splash/${name}`;
    assert.equal(existsSync(path), true);
    assert.deepEqual(readPngSize(path), { width, height });
    assert.match(indexHtml, new RegExp(`<link rel="apple-touch-startup-image" href="/assets/splash/${name}"`));
    assert.match(serviceWorker, new RegExp(`"/assets/splash/${name}"`));
  });
});

test("android install experience exposes standalone maskable PWA and app shortcuts", () => {
  assert.equal(manifestJson.start_url, "/");
  assert.equal(manifestJson.scope, "/");
  assert.equal(manifestJson.display, "standalone");
  assert.equal(manifestJson.theme_color, "#1F2937");
  assert.equal(manifestJson.background_color, "#111827");
  assert.equal(manifestJson.prefer_related_applications, false);
  assert.equal(manifestJson.categories.includes("productivity"), true);
  assert.equal(manifestJson.icons.some(icon => icon.src === "/assets/icons/maskable-v2-192.png" && icon.purpose === "maskable"), true);
  assert.equal(manifestJson.icons.some(icon => icon.src === "/assets/icons/maskable-v2-512.png" && icon.purpose === "maskable"), true);

  assert.deepEqual(manifestJson.shortcuts.map(shortcut => shortcut.url), [
    "/?open=reminder",
    "/?open=schedules",
    "/?open=diary",
  ]);
  assert.equal(manifestJson.shortcuts.every(shortcut => shortcut.icons?.some(icon => icon.src === "/assets/icons/icon-v2-192.png")), true);

  assert.match(serviceWorker, /"\/assets\/icons\/icon-v2-192\.png"/);
  assert.match(serviceWorker, /"\/assets\/icons\/maskable-v2-512\.png"/);
  assert.match(appJs, /installShortcutTargets/);
  assert.match(appJs, /getInitialLaunchTarget/);
  assert.match(appJs, /openInitialLaunchTarget/);
});

test("settings include install quality diagnostics and PWA update controls", () => {
  assert.match(indexHtml, /id="pwaInstallSummary"/);
  assert.match(indexHtml, /id="pwaInstallDiagnostics"/);
  assert.match(indexHtml, /id="pwaInstallCheckButton"/);
  assert.match(appCss, /\.install-quality-panel\s*{/);
  assert.match(appCss, /\.install-diagnostic--ok i\s*{/);
  assert.match(appCss, /\.install-diagnostic--bad i\s*{/);
  assert.match(appCss, /\.install-diagnostic small\s*{/);
  assert.match(appJs, /function getDeviceRuntimeProfile/);
  assert.match(appJs, /title: "Платформа"/);
  assert.match(appJs, /title: "Адрес"/);
  assert.match(appJs, /title: "Push API"/);
  assert.match(appJs, /function renderInstallDiagnostics/);
  assert.match(appJs, /function runInstallQualityAction/);
  assert.match(appJs, /focus-pwa-state-change/);
  assert.match(pwaJs, /focusPwaCheckForUpdate/);
  assert.match(pwaJs, /focusPwaApplyUpdate/);
  assert.match(serviceWorker, /focus-pwa-v86/);
  assert.match(serviceWorker, /SKIP_WAITING/);
});

test("settings include device verification checklist", () => {
  assert.match(indexHtml, /id="deviceCheckSummary"/);
  assert.match(indexHtml, /id="deviceCheckList"/);
  assert.match(indexHtml, /id="deviceCheckRefreshButton"/);
  assert.match(indexHtml, /id="deviceCheckTestButton"/);
  assert.match(indexHtml, /id="deviceCheckReminderButton"/);
  assert.match(appCss, /\.device-check-panel\s*{/);
  assert.match(appCss, /\.device-check-item--ok i\s*{/);
  assert.match(appCss, /\.device-check-item--bad i\s*{/);
  assert.match(appJs, /function getDeviceCheckItems/);
  assert.match(appJs, /function renderDeviceCheck/);
  assert.match(appJs, /function refreshDeviceCheck/);
  assert.match(appJs, /deviceCheckPushTestState/);
});

test("sidebar exposes useful services hub", () => {
  assert.match(indexHtml, /data-open-modal="useful"/);
  assert.match(indexHtml, /id="usefulModal"/);
  assert.match(indexHtml, /Полезное/);
  assert.match(indexHtml, /Будущий центр дополнительных функций/);
  assert.match(appCss, /\.useful-grid\s*{/);
  assert.match(appCss, /\.useful-card\s*{/);
  assert.match(appCss, /\.icon-sparkles\s*{/);
  assert.match(appJs, /useful:\s*document\.querySelector\("#usefulModal"\)/);
});

test("reminders center includes push readiness diagnostics", () => {
  assert.match(indexHtml, /id="reminderPushSummary"/);
  assert.match(indexHtml, /id="reminderPushDiagnostics"/);
  assert.match(indexHtml, /id="reminderPushEvents"/);
  assert.match(appCss, /\.notification-panel\s*{/);
  assert.match(appCss, /\.notification-diagnostic--ok i\s*{/);
  assert.match(appCss, /\.notification-diagnostic--bad i\s*{/);
  assert.match(appCss, /\.notification-diagnostic small\s*{/);
  assert.match(appCss, /\.notification-events\s*{/);
  assert.match(appCss, /\.notification-event--ok em\s*{/);
  assert.match(appCss, /\.saved-schedules-head\s*{[\s\S]*?grid-template-columns:\s*1fr;/);
  assert.match(appCss, /\.saved-schedules-head \.primary-button\s*{[\s\S]*?white-space:\s*normal;/);
  assert.match(appJs, /title: "Среда"/);
  assert.match(appJs, /iOS: нужна установка/);
  assert.match(appJs, /function getReminderPushDiagnosticItems/);
  assert.match(appJs, /function getReminderDeliveryDiagnosticItem/);
  assert.match(appJs, /scheduleSync\.getReminderDeliveryStatus/);
  assert.match(appJs, /scheduleSync\.getPushEvents/);
  assert.match(appJs, /function refreshReminderPushDiagnostics/);
  assert.match(appJs, /function renderPushEventLog/);
  assert.match(appJs, /function getPushEventDetails/);
  assert.match(appJs, /function formatPushEventRetryTime/);
  assert.match(appJs, /event\?\.attempts/);
  assert.match(appJs, /event\?\.maxAttempts/);
  assert.match(appJs, /event\?\.nextRetryAt/);
  assert.match(appJs, /stats\.retrying/);
  assert.match(appJs, /stats\.retryExhausted/);
  assert.match(appJs, /retry-exhausted/);
  assert.match(appJs, /needsServerRegistration/);
  assert.match(appJs, /function getPushEnablePreflightMessage/);
  assert.match(appJs, /function enableReminderPushFromButton/);
  assert.match(appJs, /canShowIosInstallHelp/);
  assert.match(appJs, /Как включить/);
  assert.match(appJs, /testButton\.disabled = permission !== "granted";/);
  assert.match(appJs, /refreshReminderPushDiagnostics\(\{ register: true \}\)/);
  assert.match(appJs, /!state\.status\?\.deviceRegistered/);
  assert.match(appJs, /state\.registration = await registerServerPushSubscription\(\)/);
});

function readPngSize(path) {
  const buffer = readFileSync(path);
  assert.equal(buffer.toString("ascii", 1, 4), "PNG");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readWebpSize(path) {
  const buffer = readFileSync(path);
  assert.equal(buffer.toString("ascii", 0, 4), "RIFF");
  assert.equal(buffer.toString("ascii", 8, 12), "WEBP");

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkOffset = offset + 8;

    if (chunkType === "VP8X") {
      return {
        width: buffer.readUIntLE(chunkOffset + 4, 3) + 1,
        height: buffer.readUIntLE(chunkOffset + 7, 3) + 1,
      };
    }

    if (chunkType === "VP8L") {
      const b1 = buffer[chunkOffset + 1];
      const b2 = buffer[chunkOffset + 2];
      const b3 = buffer[chunkOffset + 3];
      const b4 = buffer[chunkOffset + 4];
      return {
        width: 1 + b1 + ((b2 & 0x3f) << 8),
        height: 1 + (b2 >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10),
      };
    }

    if (chunkType === "VP8 ") {
      return {
        width: buffer.readUInt16LE(chunkOffset + 6) & 0x3fff,
        height: buffer.readUInt16LE(chunkOffset + 8) & 0x3fff,
      };
    }

    offset += 8 + chunkSize + (chunkSize % 2);
  }

  throw new Error(`Cannot read WebP size for ${path}`);
}
