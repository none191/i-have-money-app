// lib/csvExport.mjs
//
// Pure CSV formatting helpers. No DOM dependency. Extracted from app.js so
// the formula-injection guard (the actual security-relevant behavior) can
// be exercised directly under node:test instead of only indirectly via a
// browser download.

/**
 * Escape a single CSV cell value:
 *   - Coerce to string (null/undefined become "")
 *   - If the value starts with =, +, -, or @, prefix it with a single quote.
 *     Spreadsheet applications (Excel, Google Sheets, LibreOffice Calc) all
 *     treat cells starting with any of those four characters as formulas by
 *     default. Without this guard, a transaction note or category containing
 *     something like `=HYPERLINK("http://evil.example","click")` or
 *     `=cmd|'/c calc'!A1` would execute as a formula the moment the exported
 *     CSV is opened -- this is the well-known "CSV/Excel formula injection"
 *     class of vulnerability. The leading `'` forces spreadsheet apps to
 *     treat the cell as literal text instead.
 *   - Wrap in double quotes and escape any embedded double quotes per the
 *     CSV spec (RFC 4180).
 */
export function csvCell(cell) {
  const text = String(cell ?? "");
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

/**
 * Build a full CSV document (header + rows) from arrays of raw cell values,
 * escaping every cell with csvCell. Joins with \n and does not include a
 * BOM -- callers that want Excel to auto-detect UTF-8 should prepend
 * "\ufeff" themselves (as app.js's exportCsv does).
 */
export function buildCsv(header, rows) {
  return [header, ...rows].map(row => row.map(csvCell).join(",")).join("\n");
}

if (typeof window !== "undefined") {
  window.IHM_CSV_EXPORT = { csvCell, buildCsv };
}
