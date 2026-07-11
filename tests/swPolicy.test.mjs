import test from "node:test";
import assert from "node:assert/strict";
import { isSameOrigin, classifyRequest, chooseStrategy, resolveFetchPlan } from "../lib/swPolicy.mjs";

const PAGE_ORIGIN = "https://money.example.com";

test("isSameOrigin: same origin true, cross-origin false", () => {
  assert.equal(isSameOrigin("https://money.example.com/app.js", PAGE_ORIGIN), true);
  assert.equal(isSameOrigin("/app.js", PAGE_ORIGIN), true, "relative URL resolves against page origin");
  assert.equal(isSameOrigin("https://www.googleapis.com/drive/v3/files", PAGE_ORIGIN), false);
  assert.equal(isSameOrigin("https://accounts.google.com/gsi/client", PAGE_ORIGIN), false);
});

test("isSameOrigin returns false (not throw) when the URL constructor rejects malformed input", () => {
  assert.equal(isSameOrigin("http://[invalid", PAGE_ORIGIN), false);
  assert.equal(isSameOrigin("http://", PAGE_ORIGIN), false);
});

test("isSameOrigin: a relative-looking garbage string still resolves against the page origin (expected URL behavior, not a bug)", () => {
  // `new URL()` treats an unresolvable scheme-less string as a relative path
  // against the base, so it correctly resolves to same-origin rather than
  // throwing. This is intentional URL-spec behavior, not a security gap:
  // it never crosses into a different origin.
  assert.equal(isSameOrigin("not a url at all", PAGE_ORIGIN), true);
});

test("classifyRequest: non-GET is always non-get regardless of origin", () => {
  assert.equal(classifyRequest({ url: "/api/thing", method: "POST" }, PAGE_ORIGIN), "non-get");
});

test("classifyRequest: cross-origin GET is cross-origin even if it looks like a document", () => {
  const classification = classifyRequest(
    { url: "https://www.googleapis.com/drive/v3/files", method: "GET", mode: "navigate" },
    PAGE_ORIGIN
  );
  assert.equal(classification, "cross-origin");
});

test("classifyRequest: same-origin navigation", () => {
  assert.equal(
    classifyRequest({ url: "/index.html", method: "GET", mode: "navigate" }, PAGE_ORIGIN),
    "navigation"
  );
  assert.equal(
    classifyRequest({ url: "/", method: "GET", destination: "document" }, PAGE_ORIGIN),
    "navigation"
  );
});

test("classifyRequest: same-origin static assets", () => {
  for (const destination of ["script", "style", "image", "font", "manifest"]) {
    assert.equal(
      classifyRequest({ url: "/app.js", method: "GET", destination }, PAGE_ORIGIN),
      "static-asset",
      `destination=${destination} should be static-asset`
    );
  }
});

test("classifyRequest: same-origin non-navigation non-static request is 'other', not navigation", () => {
  const classification = classifyRequest(
    { url: "/api/some-future-endpoint", method: "GET", destination: "empty" },
    PAGE_ORIGIN
  );
  assert.equal(classification, "other");
});

test("chooseStrategy: navigation -> network-first", () => {
  assert.equal(chooseStrategy("navigation"), "network-first");
});

test("chooseStrategy: static-asset -> stale-while-revalidate", () => {
  assert.equal(chooseStrategy("static-asset"), "stale-while-revalidate");
});

test("chooseStrategy: cross-origin and other -> network-only (never index.html fallback)", () => {
  assert.equal(chooseStrategy("cross-origin"), "network-only");
  assert.equal(chooseStrategy("other"), "network-only");
});

test("chooseStrategy: non-get -> bypass", () => {
  assert.equal(chooseStrategy("non-get"), "bypass");
});

test("resolveFetchPlan: image request never resolves to network-first (regression guard for H-1)", () => {
  const plan = resolveFetchPlan({ url: "/icons/favicon.svg", method: "GET", destination: "image" }, PAGE_ORIGIN);
  assert.equal(plan.classification, "static-asset");
  assert.equal(plan.strategy, "stale-while-revalidate");
  assert.notEqual(plan.strategy, "network-first");
});

test("resolveFetchPlan: cross-origin Google API call is never cached or given the offline shell (regression guard for H-1)", () => {
  const plan = resolveFetchPlan(
    { url: "https://www.googleapis.com/upload/drive/v3/files", method: "GET" },
    PAGE_ORIGIN
  );
  assert.equal(plan.classification, "cross-origin");
  assert.equal(plan.strategy, "network-only");
});

test("resolveFetchPlan: app.js script request is stale-while-revalidate not network-first", () => {
  const plan = resolveFetchPlan({ url: "/app.js?v=phase2", method: "GET", destination: "script" }, PAGE_ORIGIN);
  assert.equal(plan.strategy, "stale-while-revalidate");
});
