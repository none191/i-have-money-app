import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyStorageError,
  trySetItem,
  formatBytes,
  estimateStorageUsageBytes,
  snapshotKeys,
  restoreSnapshot
} from "../lib/storageSafety.mjs";

/**
 * Minimal in-memory Storage-like object mimicking the real localStorage
 * interface (length/key/getItem/setItem/removeItem), with an optional
 * quota so tests can force a real QuotaExceededError-shaped throw.
 */
function createMockStorage({ quotaBytes = Infinity } = {}) {
  const map = new Map();
  function currentBytes() {
    let total = 0;
    for (const [k, v] of map) total += (k.length + v.length) * 2;
    return total;
  }
  return {
    get length() { return map.size; },
    key(index) { return Array.from(map.keys())[index] ?? null; },
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) {
      const strValue = String(value);
      const projected = currentBytes() - ((map.get(key)?.length || 0) * 2) + (key.length + strValue.length) * 2;
      if (projected > quotaBytes) {
        const error = new DOMException("The quota has been exceeded.", "QuotaExceededError");
        throw error;
      }
      map.set(key, strValue);
    },
    removeItem(key) { map.delete(key); },
    _dump() { return Object.fromEntries(map); }
  };
}

// --- classifyStorageError ----------------------------------------------------

test("classifyStorageError identifies a standard DOMException QuotaExceededError", () => {
  const error = new DOMException("quota", "QuotaExceededError");
  const result = classifyStorageError(error);
  assert.equal(result.isQuotaError, true);
  assert.equal(result.isStorageUnavailable, false);
});

test("classifyStorageError identifies legacy Firefox numeric quota code", () => {
  const error = { name: "NS_ERROR_DOM_QUOTA_REACHED", code: 1014 };
  assert.equal(classifyStorageError(error).isQuotaError, true);
});

test("classifyStorageError identifies SecurityError as storage-unavailable (e.g. locked-down private mode)", () => {
  const error = new DOMException("blocked", "SecurityError");
  const result = classifyStorageError(error);
  assert.equal(result.isStorageUnavailable, true);
  assert.equal(result.isQuotaError, false);
});

test("classifyStorageError treats unrecognized errors as unknown, not silently as quota", () => {
  const error = new TypeError("something else broke");
  const result = classifyStorageError(error);
  assert.equal(result.isQuotaError, false);
  assert.equal(result.isStorageUnavailable, false);
  assert.equal(result.isUnknown, true);
});

test("classifyStorageError handles null/undefined gracefully", () => {
  assert.equal(classifyStorageError(null).isUnknown, true);
  assert.equal(classifyStorageError(undefined).isUnknown, true);
});

// --- trySetItem ---------------------------------------------------------------

test("trySetItem returns ok:true on a normal write", () => {
  const storage = createMockStorage();
  const result = trySetItem(storage, "a", "1");
  assert.equal(result.ok, true);
  assert.equal(storage.getItem("a"), "1");
});

test("trySetItem catches QuotaExceededError instead of throwing, and classifies it", () => {
  const storage = createMockStorage({ quotaBytes: 20 });
  const result = trySetItem(storage, "a", "a very long value that exceeds the tiny mock quota");
  assert.equal(result.ok, false);
  assert.equal(result.classification.isQuotaError, true);
});

// --- formatBytes ----------------------------------------------------------

test("formatBytes formats across units", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB");
});

test("formatBytes handles invalid input without throwing", () => {
  assert.equal(formatBytes(NaN), "0 B");
  assert.equal(formatBytes(-5), "0 B");
});

// --- estimateStorageUsageBytes ---------------------------------------------

test("estimateStorageUsageBytes sums key+value length (UTF-16 code units x2) across all entries", () => {
  const storage = createMockStorage();
  storage.setItem("a", "12345");     // key 1 + value 5 = 6 code units -> 12 bytes
  storage.setItem("bb", "1234567890"); // key 2 + value 10 = 12 code units -> 24 bytes
  assert.equal(estimateStorageUsageBytes(storage), 36);
});

test("estimateStorageUsageBytes returns 0 for empty storage", () => {
  const storage = createMockStorage();
  assert.equal(estimateStorageUsageBytes(storage), 0);
});

// --- snapshotKeys / restoreSnapshot (rollback support for restore) --------

test("snapshotKeys captures current values, including null for absent keys", () => {
  const storage = createMockStorage();
  storage.setItem("existing", "old-value");
  const snapshot = snapshotKeys(storage, ["existing", "missing"]);
  assert.deepEqual(snapshot, { existing: "old-value", missing: null });
});

test("restoreSnapshot writes back previous values and removes keys that did not exist before", () => {
  const storage = createMockStorage();
  storage.setItem("existing", "old-value");
  const snapshot = snapshotKeys(storage, ["existing", "newly-added"]);

  // Simulate a partially-applied write sequence that we now want to undo
  storage.setItem("existing", "corrupted-new-value");
  storage.setItem("newly-added", "should not survive rollback");

  const failed = restoreSnapshot(storage, snapshot);
  assert.deepEqual(failed, []);
  assert.equal(storage.getItem("existing"), "old-value");
  assert.equal(storage.getItem("newly-added"), null);
});

test("restoreSnapshot reports keys it could not restore instead of throwing (best-effort, not atomic)", () => {
  const storage = createMockStorage({ quotaBytes: 10 });
  // Pre-fill so restoring "big" back would exceed the tiny quota
  const snapshot = { big: "this value will not fit back into the tiny mock quota" };
  const failed = restoreSnapshot(storage, snapshot);
  assert.deepEqual(failed, ["big"]);
});
