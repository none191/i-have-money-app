const CACHE_NAME = "i-have-money-v5-phase2-cleanup";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=settings-polish-3",
  "./app.js?v=phase2",
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
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request).then(networkResponse => {
      return networkResponse;
    }).catch(() => caches.match("./index.html")))
  );
});
