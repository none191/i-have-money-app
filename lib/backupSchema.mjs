// lib/backupSchema.mjs
//
// Pure validation/normalization/migration logic for I Have Money backup files.
// No DOM, no localStorage, no browser globals — safe to run under Node's
// built-in test runner (`node --test`) and in the browser via the
// window.IHM_BACKUP_SCHEMA bridge created at the bottom of this file.
//
// This module is the SINGLE SOURCE OF TRUTH for what a valid backup payload
// looks like. app.js must not duplicate these rules — it should call into
// this module so that tests exercising this file are actually exercising
// the same logic the app runs in production.

export const BACKUP_SCHEMA_VERSION = 1;

export const RESERVED_KEYS = ["__proto__", "prototype", "constructor"];

export function isReservedKey(value) {
  return RESERVED_KEYS.includes(String(value ?? "").trim());
}

/**
 * JSON.parse with a reviver that drops any "__proto__"/"prototype"/"constructor"
 * key at every nesting level, as defense-in-depth against prototype pollution
 * from a malformed/malicious backup file — even though modern JS engines do
 * not let JSON.parse itself write to Object.prototype, code further down the
 * pipeline (Object.assign, spread, etc.) could still be tricked by an own
 * "__proto__" property surviving a naive JSON.parse.
 *
 * Throws SyntaxError-like errors the same way JSON.parse does for invalid JSON.
 */
export function safeJsonParse(text) {
  return JSON.parse(text, (key, value) => {
    if (isReservedKey(key)) return undefined;
    return value;
  });
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && toDateInputValue(date) === value;
}

function toDateInputValue(date) {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date - tzOffset).toISOString().slice(0, 10);
}

/**
 * Validate a single transaction record. Returns { valid, errors }.
 * Does not mutate the input.
 */
export function validateTransaction(tx, index = 0) {
  const errors = [];
  const prefix = `transactions[${index}]`;
  if (!tx || typeof tx !== "object" || Array.isArray(tx)) {
    return { valid: false, errors: [`${prefix}: must be an object`] };
  }
  if (typeof tx.id !== "string" || !tx.id.trim()) errors.push(`${prefix}.id: required non-empty string`);
  if (tx.type !== "income" && tx.type !== "expense") errors.push(`${prefix}.type: must be "income" or "expense"`);
  if (!isValidDateString(tx.date)) errors.push(`${prefix}.date: must be a valid YYYY-MM-DD date`);
  const amount = Number(tx.amount);
  if (!Number.isFinite(amount) || amount <= 0) errors.push(`${prefix}.amount: must be a finite number > 0`);
  const category = String(tx.category ?? "").trim();
  if (!category || isReservedKey(category)) errors.push(`${prefix}.category: required, and must not be a reserved key`);
  if (tx.receipt !== undefined && typeof tx.receipt !== "string") errors.push(`${prefix}.receipt: must be a string when present`);
  return { valid: errors.length === 0, errors };
}

/**
 * Normalize a single transaction that has already passed validateTransaction.
 * Strips unknown/dangerous fields and coerces types.
 */
export function normalizeTransaction(tx) {
  const amount = Number(tx.amount);
  return {
    id: String(tx.id),
    type: tx.type === "income" ? "income" : "expense",
    date: tx.date,
    amount,
    category: String(tx.category).trim(),
    note: typeof tx.note === "string" ? tx.note : "",
    receipt: typeof tx.receipt === "string" ? tx.receipt : "",
    createdAt: typeof tx.createdAt === "string" && !Number.isNaN(Date.parse(tx.createdAt)) ? tx.createdAt : new Date().toISOString(),
    updatedAt: typeof tx.updatedAt === "string" && !Number.isNaN(Date.parse(tx.updatedAt)) ? tx.updatedAt : new Date().toISOString()
  };
}

export function normalizeBudgets(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value).reduce((acc, [cat, amount]) => {
    const key = String(cat || "").trim();
    const numericAmount = Number(amount || 0);
    if (key && !isReservedKey(key) && Number.isFinite(numericAmount) && numericAmount >= 0) {
      acc[key] = numericAmount;
    }
    return acc;
  }, {});
}

export function normalizeCategories(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const clean = (list) => Array.isArray(list)
    ? [...new Set(list.map(item => String(item || "").trim()).filter(item => item && !isReservedKey(item)))]
    : [];
  return { income: clean(source.income), expense: clean(source.expense) };
}

export function normalizeCategoryIcons(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([cat, icon]) => [String(cat || "").trim(), String(icon || "").trim().slice(0, 8)])
      .filter(([cat, icon]) => cat && icon && !isReservedKey(cat))
  );
}

const ALLOWED_SYNC_MODES = new Set(["local", "google-drive"]);

export function normalizeSettings(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const syncMode = ALLOWED_SYNC_MODES.has(source.syncMode) ? source.syncMode : "local";
  return {
    syncMode,
    googleDriveConnected: String(source.googleDriveConnected || ""),
    lastBackup: String(source.lastBackup || ""),
    lastSync: String(source.lastSync || ""),
    lastSyncError: String(source.lastSyncError || "")
  };
}

/**
 * Migrate a raw backup payload to BACKUP_SCHEMA_VERSION.
 * Returns { payload, fromVersion, migrated }.
 * Throws if the payload declares a version newer than this build understands
 * (never guess-downgrade a future format).
 */
export function migrateBackupPayload(rawPayload) {
  const declaredVersion = Number.isInteger(rawPayload?.version) ? rawPayload.version : 0;
  if (declaredVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error(
      `ไฟล์สำรองข้อมูลนี้ถูกสร้างจากแอปเวอร์ชันใหม่กว่า (version ${declaredVersion}) ` +
      `แอปนี้รองรับสูงสุด version ${BACKUP_SCHEMA_VERSION} กรุณาอัปเดตแอปก่อนนำเข้า`
    );
  }
  // version 0 (undeclared / legacy pre-versioning files) and version 1 currently
  // share the same field shape, so migration is a no-op today. This function is
  // the designated place to add real field transforms when BACKUP_SCHEMA_VERSION
  // is bumped in the future (e.g. version 1 -> 2 renaming a field).
  const migrated = declaredVersion !== BACKUP_SCHEMA_VERSION;
  return {
    payload: { ...rawPayload, version: BACKUP_SCHEMA_VERSION },
    fromVersion: declaredVersion,
    migrated
  };
}

/**
 * Validate + normalize a full backup payload in memory. Never touches
 * localStorage or any browser API. Returns:
 *   { ok: true,  normalized: {...}, warnings: string[] }
 *   { ok: false, errors: string[] }
 */
export function validateAndNormalizeBackupPayload(rawPayload) {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    return { ok: false, errors: ["backup payload ต้องเป็น object"] };
  }

  let migration;
  try {
    migration = migrateBackupPayload(rawPayload);
  } catch (error) {
    return { ok: false, errors: [error.message] };
  }
  const payload = migration.payload;

  const errors = [];
  const rawTransactions = Array.isArray(payload.transactions) ? payload.transactions : [];
  if (!Array.isArray(payload.transactions)) errors.push("transactions: ต้องเป็น array");

  const normalizedTransactions = [];
  rawTransactions.forEach((tx, index) => {
    const result = validateTransaction(tx, index);
    if (!result.valid) {
      errors.push(...result.errors);
      return;
    }
    normalizedTransactions.push(normalizeTransaction(tx));
  });

  // Duplicate id check across the whole set (only meaningful once individual
  // records already passed shape validation above).
  const seenIds = new Set();
  const duplicateIds = new Set();
  normalizedTransactions.forEach(tx => {
    if (seenIds.has(tx.id)) duplicateIds.add(tx.id);
    seenIds.add(tx.id);
  });
  if (duplicateIds.size) errors.push(`transactions: พบ id ซ้ำ ${duplicateIds.size} รายการ`);

  if (errors.length) {
    return { ok: false, errors };
  }

  const normalized = {
    app: typeof payload.app === "string" ? payload.app : "I Have Money",
    version: BACKUP_SCHEMA_VERSION,
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : new Date().toISOString(),
    user: normalizeBackupUser(payload.user),
    transactions: normalizedTransactions,
    budgets: normalizeBudgets(payload.budgets),
    categories: normalizeCategories(payload.categories),
    categoryIcons: normalizeCategoryIcons(payload.categoryIcons),
    settings: normalizeSettings(payload.settings),
    preferences: payload.preferences && typeof payload.preferences === "object" && !Array.isArray(payload.preferences) ? payload.preferences : {}
  };

  const warnings = [];
  if (migration.migrated) warnings.push(`อัปเกรดไฟล์สำรองจาก version ${migration.fromVersion} เป็น ${BACKUP_SCHEMA_VERSION}`);

  return { ok: true, normalized, warnings };
}

function normalizeBackupUser(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { email: "", name: "", googleId: "" };
  return {
    email: String(value.email || "").trim().toLowerCase(),
    name: String(value.name || "").trim(),
    googleId: String(value.googleId || "").trim()
  };
}

// --- Browser bridge -------------------------------------------------------
// app.js is a classic (non-module) script for backward compatibility, so it
// cannot `import` this file directly. This module is loaded separately with
// <script type="module"> and publishes its exports on `window` so app.js can
// call window.IHM_BACKUP_SCHEMA.validateAndNormalizeBackupPayload(...) etc.
// Guarded so this file also loads cleanly under Node (no `window` there).
if (typeof window !== "undefined") {
  window.IHM_BACKUP_SCHEMA = {
    BACKUP_SCHEMA_VERSION,
    isReservedKey,
    safeJsonParse,
    isValidDateString,
    validateTransaction,
    normalizeTransaction,
    normalizeBudgets,
    normalizeCategories,
    normalizeCategoryIcons,
    normalizeSettings,
    migrateBackupPayload,
    validateAndNormalizeBackupPayload
  };
}
