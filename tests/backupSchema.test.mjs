import test from "node:test";
import assert from "node:assert/strict";
import {
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
} from "../lib/backupSchema.mjs";

function validTx(overrides = {}) {
  return {
    id: "tx-1",
    type: "expense",
    date: "2026-01-15",
    amount: 120,
    category: "อาหาร",
    note: "ข้าวเที่ยง",
    receipt: "",
    createdAt: "2026-01-15T05:00:00.000Z",
    updatedAt: "2026-01-15T05:00:00.000Z",
    ...overrides
  };
}

function validPayload(overrides = {}) {
  return {
    app: "I Have Money",
    version: BACKUP_SCHEMA_VERSION,
    updatedAt: "2026-01-15T05:00:00.000Z",
    user: { email: "demo@ihavemoney.app", name: "Demo User", googleId: "" },
    transactions: [validTx()],
    budgets: { อาหาร: 3000 },
    categories: { income: ["เงินเดือน"], expense: ["อาหาร"] },
    categoryIcons: { อาหาร: "🍜" },
    settings: { syncMode: "local", googleDriveConnected: "", lastBackup: "", lastSync: "", lastSyncError: "" },
    preferences: {},
    ...overrides
  };
}

// --- isReservedKey / prototype pollution guards ---------------------------

test("isReservedKey flags __proto__, prototype, constructor", () => {
  assert.equal(isReservedKey("__proto__"), true);
  assert.equal(isReservedKey("constructor"), true);
  assert.equal(isReservedKey("prototype"), true);
  assert.equal(isReservedKey("อาหาร"), false);
  assert.equal(isReservedKey(""), false);
});

test("safeJsonParse strips __proto__ keys at every nesting level", () => {
  const malicious = '{"a":1,"__proto__":{"polluted":true},"nested":{"__proto__":{"polluted":true}}}';
  const parsed = safeJsonParse(malicious);
  assert.equal(parsed.a, 1);
  assert.equal(({}).polluted, undefined, "Object.prototype must not be polluted");
  assert.equal(parsed.nested.polluted, undefined);
});

test("safeJsonParse still throws on genuinely invalid JSON", () => {
  assert.throws(() => safeJsonParse("{ not valid json"));
});

// --- date validation --------------------------------------------------------

test("isValidDateString accepts real calendar dates only", () => {
  assert.equal(isValidDateString("2026-01-15"), true);
  assert.equal(isValidDateString("2026-02-30"), false, "Feb 30 does not exist");
  assert.equal(isValidDateString("15-01-2026"), false, "wrong format");
  assert.equal(isValidDateString("2026-1-5"), false, "must be zero-padded");
  assert.equal(isValidDateString(""), false);
  assert.equal(isValidDateString(null), false);
});

// --- validateTransaction ----------------------------------------------------

test("validateTransaction accepts a well-formed transaction", () => {
  const result = validateTransaction(validTx());
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("validateTransaction rejects amount <= 0", () => {
  const result = validateTransaction(validTx({ amount: 0 }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes("amount")));
});

test("validateTransaction rejects non-finite amount (Infinity/NaN)", () => {
  assert.equal(validateTransaction(validTx({ amount: Infinity })).valid, false);
  assert.equal(validateTransaction(validTx({ amount: NaN })).valid, false);
  assert.equal(validateTransaction(validTx({ amount: "not-a-number" })).valid, false);
});

test("validateTransaction rejects type other than income/expense", () => {
  const result = validateTransaction(validTx({ type: "hack" }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes("type")));
});

test("validateTransaction rejects malformed date", () => {
  assert.equal(validateTransaction(validTx({ date: "not-a-date" })).valid, false);
  assert.equal(validateTransaction(validTx({ date: "2026-13-40" })).valid, false);
});

test("validateTransaction rejects reserved-word category (prototype pollution attempt)", () => {
  const result = validateTransaction(validTx({ category: "__proto__" }));
  assert.equal(result.valid, false);
});

test("validateTransaction rejects missing id", () => {
  assert.equal(validateTransaction(validTx({ id: "" })).valid, false);
  assert.equal(validateTransaction(validTx({ id: undefined })).valid, false);
});

test("validateTransaction rejects non-string receipt", () => {
  assert.equal(validateTransaction(validTx({ receipt: 12345 })).valid, false);
});

// --- normalizeBudgets / normalizeCategories / normalizeCategoryIcons -------

test("normalizeBudgets drops reserved keys and negative/non-finite amounts", () => {
  const result = normalizeBudgets({
    อาหาร: 3000,
    "__proto__": 999,
    เดินทาง: -50,
    ของใช้: Infinity,
    "  ": 100
  });
  assert.deepEqual(result, { อาหาร: 3000 });
});

test("normalizeCategories dedupes and drops reserved/empty entries", () => {
  const result = normalizeCategories({
    income: ["เงินเดือน", "เงินเดือน", "  ", "__proto__"],
    expense: ["อาหาร"]
  });
  assert.deepEqual(result.income, ["เงินเดือน"]);
  assert.deepEqual(result.expense, ["อาหาร"]);
});

test("normalizeCategories handles missing/malformed input gracefully", () => {
  assert.deepEqual(normalizeCategories(null), { income: [], expense: [] });
  assert.deepEqual(normalizeCategories([1, 2, 3]), { income: [], expense: [] });
});

test("normalizeCategoryIcons drops reserved keys and empty values", () => {
  const result = normalizeCategoryIcons({ อาหาร: "🍜", "__proto__": "💀", เดินทาง: "" });
  assert.deepEqual(result, { อาหาร: "🍜" });
});

test("normalizeSettings only allows known sync modes", () => {
  assert.equal(normalizeSettings({ syncMode: "supabase-hack" }).syncMode, "local");
  assert.equal(normalizeSettings({ syncMode: "google-drive" }).syncMode, "google-drive");
  assert.equal(normalizeSettings(null).syncMode, "local");
});

// --- migrateBackupPayload ---------------------------------------------------

test("migrateBackupPayload accepts current version as a no-op", () => {
  const result = migrateBackupPayload({ version: BACKUP_SCHEMA_VERSION });
  assert.equal(result.migrated, false);
  assert.equal(result.payload.version, BACKUP_SCHEMA_VERSION);
});

test("migrateBackupPayload treats missing/legacy version as version 0 and migrates", () => {
  const result = migrateBackupPayload({ transactions: [] });
  assert.equal(result.fromVersion, 0);
  assert.equal(result.migrated, true);
  assert.equal(result.payload.version, BACKUP_SCHEMA_VERSION);
});

test("migrateBackupPayload rejects a backup from a newer, unknown future version", () => {
  assert.throws(
    () => migrateBackupPayload({ version: BACKUP_SCHEMA_VERSION + 1 }),
    /เวอร์ชันใหม่กว่า|newer/i
  );
});

// --- validateAndNormalizeBackupPayload (full pipeline) ---------------------

test("validateAndNormalizeBackupPayload accepts a well-formed backup", () => {
  const result = validateAndNormalizeBackupPayload(validPayload());
  assert.equal(result.ok, true);
  assert.equal(result.normalized.transactions.length, 1);
  assert.equal(result.normalized.user.email, "demo@ihavemoney.app");
});

test("validateAndNormalizeBackupPayload rejects non-object payload", () => {
  assert.equal(validateAndNormalizeBackupPayload(null).ok, false);
  assert.equal(validateAndNormalizeBackupPayload("a string").ok, false);
  assert.equal(validateAndNormalizeBackupPayload([1, 2, 3]).ok, false);
});

test("validateAndNormalizeBackupPayload rejects payload with any invalid transaction (whole-file reject, not partial import)", () => {
  const payload = validPayload({
    transactions: [validTx(), validTx({ id: "tx-2", amount: -5 })]
  });
  const result = validateAndNormalizeBackupPayload(payload);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes("amount")));
});

test("validateAndNormalizeBackupPayload rejects duplicate transaction ids", () => {
  const payload = validPayload({
    transactions: [validTx({ id: "dup" }), validTx({ id: "dup" })]
  });
  const result = validateAndNormalizeBackupPayload(payload);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes("ซ้ำ")));
});

test("validateAndNormalizeBackupPayload rejects future unknown backup version", () => {
  const payload = validPayload({ version: 999 });
  const result = validateAndNormalizeBackupPayload(payload);
  assert.equal(result.ok, false);
});

test("validateAndNormalizeBackupPayload migrates a legacy no-version backup and warns", () => {
  const legacy = validPayload();
  delete legacy.version;
  const result = validateAndNormalizeBackupPayload(legacy);
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some(w => w.includes("อัปเกรด")));
});

test("validateAndNormalizeBackupPayload strips prototype-pollution attempts inside categories/budgets", () => {
  const payload = validPayload({
    budgets: { อาหาร: 100, "__proto__": 99999 },
    categories: { income: ["__proto__"], expense: ["อาหาร"] },
    categoryIcons: { "__proto__": "💀" }
  });
  const result = validateAndNormalizeBackupPayload(payload);
  assert.equal(result.ok, true);
  assert.deepEqual(result.normalized.budgets, { อาหาร: 100 });
  assert.deepEqual(result.normalized.categories.income, []);
  assert.deepEqual(result.normalized.categoryIcons, {});
  assert.equal(({}).polluted, undefined);
});

test("validateAndNormalizeBackupPayload handles empty transactions array (valid empty backup)", () => {
  const payload = validPayload({ transactions: [] });
  const result = validateAndNormalizeBackupPayload(payload);
  assert.equal(result.ok, true);
  assert.deepEqual(result.normalized.transactions, []);
});
