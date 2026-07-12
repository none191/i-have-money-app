// lib/storageSafety.mjs
//
// Pure helpers for dealing with localStorage failure modes and reporting
// usage. No implicit dependency on the global `localStorage` — every
// function that needs a Storage-like object takes it as a parameter, so
// these are fully testable under node:test with a simple in-memory mock
// that implements .length/.key()/.getItem()/.setItem()/.removeItem().

/**
 * localStorage.setItem() throws SYNCHRONOUSLY (not a silent no-op, not a
 * rejected promise) when the write would exceed the browser's quota. This
 * function classifies a caught error so callers can show the right message
 * instead of a generic "something went wrong".
 */
export function classifyStorageError(error) {
  if (!error || typeof error !== "object") {
    return { isQuotaError: false, isStorageUnavailable: false, isUnknown: true };
  }
  const name = error.name || "";
  const code = typeof error.code === "number" ? error.code : null;
  const isQuotaError =
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" || // legacy Firefox
    code === 22 ||
    code === 1014; // legacy Firefox numeric code
  const isStorageUnavailable = name === "SecurityError" || name === "InvalidStateError";
  return { isQuotaError, isStorageUnavailable, isUnknown: !isQuotaError && !isStorageUnavailable };
}

/**
 * Attempt storage.setItem(key, value); never throws. Returns a result
 * object describing what happened so the caller can decide what to do
 * (show a message, attempt rollback, etc.) instead of crashing.
 */
export function trySetItem(storage, key, value) {
  try {
    storage.setItem(key, value);
    return { ok: true };
  } catch (error) {
    return { ok: false, error, classification: classifyStorageError(error) };
  }
}

/**
 * Human-readable byte size, e.g. 1536 -> "1.5 KB".
 */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Rough estimate (in bytes) of everything currently stored in the given
 * Storage-like object. Browsers store strings as UTF-16, so this counts
 * 2 bytes per UTF-16 code unit as a conservative, well-understood
 * approximation (the same convention most "check my localStorage usage"
 * write-ups use — it will not exactly match a browser's internal quota
 * accounting, but it is stable and good enough to show the user a
 * meaningful number and trend).
 */
export function estimateStorageUsageBytes(storage) {
  let total = 0;
  const length = storage.length || 0;
  for (let i = 0; i < length; i += 1) {
    const key = storage.key(i);
    if (key === null || key === undefined) continue;
    const value = storage.getItem(key) || "";
    total += (key.length + value.length) * 2;
  }
  return total;
}

/**
 * Snapshot the current string value (or null) of a list of keys from a
 * Storage-like object, for later restoration if a subsequent write
 * sequence partially fails. localStorage has no real transactions, so this
 * "snapshot + write-back on failure" is a best-effort compensating action,
 * not an atomic guarantee.
 */
export function snapshotKeys(storage, keys) {
  const snapshot = {};
  keys.forEach(key => {
    snapshot[key] = storage.getItem(key);
  });
  return snapshot;
}

/**
 * Write back a snapshot taken by snapshotKeys(). Keys whose snapshot value
 * was null are removed (they did not exist before); others are restored to
 * their previous string value. Returns the list of keys that failed to
 * restore (should be empty in virtually all real scenarios, since writing
 * back a previously-fitting value is very unlikely to exceed quota, but we
 * do not pretend this can never fail).
 */
export function restoreSnapshot(storage, snapshot) {
  const failedKeys = [];
  Object.entries(snapshot).forEach(([key, value]) => {
    try {
      if (value === null || value === undefined) {
        storage.removeItem(key);
      } else {
        storage.setItem(key, value);
      }
    } catch {
      failedKeys.push(key);
    }
  });
  return failedKeys;
}

if (typeof window !== "undefined") {
  window.IHM_STORAGE_SAFETY = {
    classifyStorageError,
    trySetItem,
    formatBytes,
    estimateStorageUsageBytes,
    snapshotKeys,
    restoreSnapshot
  };
}
