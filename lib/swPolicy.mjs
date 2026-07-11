// lib/swPolicy.mjs
//
// Pure decision logic for the service worker's fetch handler: given a request
// description (url/method/mode/destination) and the page's own origin, decide
// how the request should be classified and which caching strategy applies.
//
// No `self`, `caches`, or `fetch` references here — this file must be safe to
// import under Node's built-in test runner. service-worker.js (a module
// service worker) imports these functions directly so the tests exercise the
// exact same logic that runs in production.

/**
 * True if requestUrl resolves to the same origin as pageOrigin.
 */
export function isSameOrigin(requestUrl, pageOrigin) {
  try {
    return new URL(requestUrl, pageOrigin).origin === pageOrigin;
  } catch {
    return false;
  }
}

const STATIC_ASSET_DESTINATIONS = new Set(["script", "style", "image", "font", "manifest"]);

/**
 * Classify a request into one of:
 *   "cross-origin"  — never intercepted; always pass straight to the network
 *   "navigation"    — full-page navigation (address bar / link / reload)
 *   "static-asset"  — script/style/image/font/manifest same-origin request
 *   "other"         — same-origin but not a navigation or a known static asset
 *                     (e.g. a JSON data request) — must never receive the
 *                     index.html fallback either.
 */
export function classifyRequest({ url, method = "GET", mode = "", destination = "" }, pageOrigin) {
  if (method !== "GET") return "non-get";
  if (!isSameOrigin(url, pageOrigin)) return "cross-origin";
  if (mode === "navigate" || destination === "document") return "navigation";
  if (STATIC_ASSET_DESTINATIONS.has(destination)) return "static-asset";
  return "other";
}

/**
 * Given a classification, decide the caching strategy to use.
 *   "network-first"          — try network, fall back to cache, then to the
 *                               offline shell (index.html) as a last resort.
 *                               Only ever appropriate for navigations.
 *   "stale-while-revalidate" — serve from cache immediately if present while
 *                               refreshing the cache in the background.
 *   "network-only"           — never touch the cache and never fall back to
 *                               index.html (cross-origin requests, and any
 *                               same-origin request that is not a navigation
 *                               or a known static asset, e.g. a future API
 *                               endpoint).
 *   "bypass"                 — do not call event.respondWith at all; let the
 *                               browser handle it natively (non-GET requests).
 */
export function chooseStrategy(classification) {
  switch (classification) {
    case "navigation":
      return "network-first";
    case "static-asset":
      return "stale-while-revalidate";
    case "non-get":
      return "bypass";
    case "cross-origin":
    case "other":
    default:
      return "network-only";
  }
}

/**
 * Convenience: run classifyRequest + chooseStrategy in one call.
 */
export function resolveFetchPlan(requestInfo, pageOrigin) {
  const classification = classifyRequest(requestInfo, pageOrigin);
  return { classification, strategy: chooseStrategy(classification) };
}

if (typeof window !== "undefined") {
  window.IHM_SW_POLICY = { isSameOrigin, classifyRequest, chooseStrategy, resolveFetchPlan };
}
