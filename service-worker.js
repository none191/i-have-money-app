// Module service worker (registered with { type: "module" } from app.js's
// registerServiceWorker()). Imports the pure routing/strategy decision logic
// from lib/swPolicy.mjs so the exact same code path is covered by
// tests/swPolicy.test.mjs under node:test — this file only wires that
// decision logic up to the real caches/fetch APIs.
import { resolveFetchPlan } from "./lib/swPolicy.mjs";

const CACHE_NAME = "i-have-money-v6-hardened-sw";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=settings-polish-3",
  "./app.js?v=phase3",
  "./lib/backupSchema.mjs?v=1",
  "./lib/storageSafety.mjs?v=1",
  "./manifest.webmanifest?v=5",
  "./icons/favicon.svg?v=5",
  "./icons/icon-192.png?v=5",
  "./icons/icon-512.png?v=5",
  "./icons/icon-maskable-512.png?v=5",
  "./icons/apple-touch-icon.png?v=5",
  "./icons/login/login-brand-transparent.png?v=2",
  "./icons/menu/menu-home.svg",
  "./icons/menu/menu-add.svg",
  "./icons/menu/menu-budget.svg",
  "./icons/menu/menu-chart.svg",
  "./icons/menu/menu-settings.svg",
  "./icons/menu/menu-calendar.svg",
  "./icons/menu/menu-income.svg",
  "./icons/menu/menu-expense.svg",
  "./icons/menu/menu-sync.svg",
  "./icons/menu/menu-dark.svg",
  "./icons/menu/menu-cat.svg",
  "./icons/menu/menu-bird.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS.map(asset => new Request(asset, { cache: "reload" }))))
  );
  // Intentionally NOT calling self.skipWaiting() here. A new service worker
  // now sits in "waiting" state until the client explicitly asks it to take
  // over (see the "message" listener below + app.js's update-notification
  // banner). This gives the user a chance to finish what they're doing and
  // click "Reload" rather than having assets swapped out mid-use.
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function putInCache(request, response) {
  // response bodies can only be read once, so callers must pass a clone()
  // in and keep the original for themselves.
  return caches.open(CACHE_NAME).then(cache => cache.put(request, response));
}

self.addEventListener("fetch", event => {
  const { request } = event;
  const plan = resolveFetchPlan(
    { url: request.url, method: request.method, mode: request.mode, destination: request.destination },
    self.location.origin
  );

  if (plan.strategy === "bypass") return; // non-GET: let the browser handle it natively
  if (plan.strategy === "network-only") return; // cross-origin (e.g. Google APIs) or unrecognized same-origin request: never cached, never given the offline shell

  if (plan.strategy === "network-first") {
    // Navigations: try the network first so users always get the latest
    // shell when online; fall back to whatever is cached, and only as a
    // last resort (fully offline + never cached) fall back to the cached
    // index.html shell.
    event.respondWith(
      fetch(request)
        .then(response => {
          event.waitUntil(putInCache(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match("./index.html")))
    );
    return;
  }

  if (plan.strategy === "stale-while-revalidate") {
    // Static same-origin assets (script/style/image/font/manifest): serve
    // from cache immediately if present, and refresh the cache from the
    // network in the background (kept alive via event.waitUntil so the
    // worker isn't terminated before the background update finishes). If
    // nothing is cached yet, fall through to the network directly — and if
    // that fails too, let it fail as a normal network error. We
    // deliberately never fall back to index.html here: returning an HTML
    // document for a broken image/script/font request would be worse than
    // a normal failed request (see finding H-1).
    event.respondWith(
      caches.match(request).then(cached => {
        const networkFetch = fetch(request).then(response => {
          event.waitUntil(putInCache(request, response.clone()));
          return response;
        });
        if (cached) {
          event.waitUntil(networkFetch.catch(() => {}));
          return cached;
        }
        return networkFetch;
      })
    );
  }
});
