import test from "node:test";
import assert from "node:assert/strict";
import { csvCell, buildCsv } from "../lib/csvExport.mjs";

test("csvCell escapes formula-triggering leading characters (=, +, -, @)", () => {
  assert.equal(csvCell("=HYPERLINK(\"http://evil.example\",\"click\")"), "\"'=HYPERLINK(\"\"http://evil.example\"\",\"\"click\"\")\"");
  assert.equal(csvCell("+1234"), "\"'+1234\"");
  assert.equal(csvCell("-1234"), "\"'-1234\"");
  assert.equal(csvCell("@SUM(A1:A2)"), "\"'@SUM(A1:A2)\"");
});

test("csvCell does not touch ordinary text that merely contains those characters mid-string", () => {
  assert.equal(csvCell("lunch @ 12pm"), "\"lunch @ 12pm\"");
  assert.equal(csvCell("a+b"), "\"a+b\"");
  assert.equal(csvCell("total-cost"), "\"total-cost\"");
});

test("csvCell escapes embedded double quotes per RFC 4180", () => {
  assert.equal(csvCell('say "hello"'), '"say ""hello"""');
});

test("csvCell coerces null/undefined to an empty quoted string", () => {
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(undefined), '""');
});

test("csvCell coerces numbers and booleans to their string form", () => {
  assert.equal(csvCell(150), '"150"');
  assert.equal(csvCell(true), '"true"');
  assert.equal(csvCell(false), '"false"');
});

test("buildCsv joins header + rows with escaped cells, one row per line", () => {
  const header = ["date", "category", "amount"];
  const rows = [
    ["2026-01-01", "อาหาร", 100],
    ["2026-01-02", "=cmd|'/c calc'!A1", -50]
  ];
  const csv = buildCsv(header, rows);
  const lines = csv.split("\n");
  assert.equal(lines.length, 3);
  assert.equal(lines[0], '"date","category","amount"');
  assert.ok(lines[2].includes("'=cmd"), "malicious formula cell must be neutralized with a leading quote");
});
