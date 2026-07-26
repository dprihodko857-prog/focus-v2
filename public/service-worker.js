const CACHE_NAME = "focus-pwa-v63";
const NAVIGATION_TIMEOUT_MS = 8000;

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/manifest.webmanifest?v=focus-logo-v2",
  "/css/tokens.css",
  "/css/app.css",
  "/js/pwa.js",
  "/js/auth.js",
  "/js/sync.js",
  "/js/notifications.js",
  "/js/storage.js",
  "/js/app.js",
  "/assets/focus-logo-v2.png",
  "/assets/brand/focus-app-icon-reference.png",
  "/assets/brand/focus-app-icon-reference-v2.png",
  "/assets/icons/apple-touch-icon-v2.png",
  "/assets/icons/favicon-v2-32.png",
  "/assets/icons/icon-v2-1024.png",
  "/assets/icons/icon-v2-192.png",
  "/assets/icons/icon-v2-512.png",
  "/assets/icons/maskable-v2-192.png",
  "/assets/icons/maskable-v2-512.png",
  "/assets/splash/iphone-8-portrait.png",
  "/assets/splash/iphone-11-portrait.png",
  "/assets/splash/iphone-12-mini-portrait.png",
  "/assets/splash/iphone-14-portrait.png",
  "/assets/splash/iphone-15-pro-portrait.png",
  "/assets/splash/iphone-15-pro-max-portrait.png",
  "/assets/splash/ipad-pro-11-portrait.png",
  "/assets/splash/ipad-pro-12-portrait.png",
  "/assets/months/large/january.webp",
  "/assets/months/large/february.webp",
  "/assets/months/large/march.webp",
  "/assets/months/large/april.webp",
  "/assets/months/large/may.webp",
  "/assets/months/large/june.webp",
  "/assets/months/large/july.webp",
  "/assets/months/large/august.webp",
  "/assets/months/large/september.webp",
  "/assets/months/large/october.webp",
  "/assets/months/large/november.webp",
  "/assets/months/large/december.webp"
];

self.addEventListener("install", event => {
  event.waitUntil(
    warmAppShellCache()
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil(openOrFocusApp(event.notification.data?.url || "/"));
});

self.addEventListener("push", event => {
  const payload = readPushPayload(event);
  const title = typeof payload.title === "string" ? payload.title : "Фокус";
  const body = typeof payload.body === "string" ? payload.body : "Есть новое напоминание";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: typeof payload.tag === "string" ? payload.tag : `focus-push-${Date.now()}`,
      renotify: true,
      icon: "/assets/icons/icon-v2-192.png",
      badge: "/assets/icons/favicon-v2-32.png",
      data: {
        reminderId: payload.reminderId || null,
        url: typeof payload.url === "string" ? payload.url : "/",
      },
    })
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  }

  if (event.data?.type === "FOCUS_CLEAR_CACHES") {
    event.waitUntil(
      clearFocusCaches().then(() => {
        event.ports?.[0]?.postMessage({ type: "FOCUS_CACHES_CLEARED" });
      })
    );
  }
});

async function warmAppShellCache() {
  const cache = await caches.open(CACHE_NAME);

  await Promise.all(
    APP_SHELL.map(async url => {
      try {
        const response = await fetch(new Request(url, { cache: "reload" }));
        if (response && response.ok) {
          await cache.put(url, response);
        }
      } catch (error) {
        console.warn("Focus PWA cache warmup skipped.", url, error);
      }
    })
  );
}

async function clearFocusCaches() {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith("focus-pwa-")).map(key => caches.delete(key)));
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetchWithTimeout(request, NAVIGATION_TIMEOUT_MS);
    const cache = await caches.open(CACHE_NAME);
    cache.put("/index.html", response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match("/index.html");
    return cached || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request).catch(() => null);

  if (response && response.ok && response.type === "basic") {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }

  return response || Response.error();
}

async function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function openOrFocusApp(url) {
  const appUrl = new URL(url, self.location.origin).href;
  const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
  const existingWindow = windows.find(client => client.url.startsWith(self.location.origin));

  if (existingWindow) {
    await existingWindow.focus();
    return existingWindow.navigate(appUrl);
  }

  return clients.openWindow(appUrl);
}

function readPushPayload(event) {
  if (!event.data) {
    return {};
  }

  try {
    return event.data.json();
  } catch {
    return { body: event.data.text() };
  }
}
