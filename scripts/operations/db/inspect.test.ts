// scripts/operations/db/inspect.test.ts — pnpm test scripts/operations/db/inspect.test.ts
// pnpm ops db inspect の純粋な部品: --json の旗の外し方と、行の JSON(表の出力は今のまま、DB には繋がない)

import assert from "node:assert/strict";
import { test } from "node:test";

import { rowsAsJson, seqScanRows, splitJsonFlag, splitMinRows } from "./lib.inspect";

test("splitJsonFlag: --json を外して旗にし、SQL の語は残す", () => {
  assert.deepEqual(splitJsonFlag(["query", "SELECT 1", "--json"]), { args: ["query", "SELECT 1"], json: true });
  assert.deepEqual(splitJsonFlag(["query", "SELECT 1"]), { args: ["query", "SELECT 1"], json: false });
});

test("rowsAsJson: 配列 1 つ(1 行)、Date は ISO、bigint は文字列", () => {
  assert.equal(rowsAsJson([]), "[]");
  const out = rowsAsJson([{ id: "a", n: BigInt(10), at: new Date("2026-11-12T00:00:00Z") }]);
  assert.equal(out, '[{"id":"a","n":"10","at":"2026-11-12T00:00:00.000Z"}]');
  assert.equal(out.includes("\\n"), false);
});

test("seqScanRows: 小さな表を外し、読んだ行の多い順、bigint の文字列も数に、印は seq が index より多く 1 回 1000 行以上", () => {
  const rows = seqScanRows([
    { table: "small", live_rows: 10, seq_scan: 500, seq_rows_read: 5000, idx_scan: 0 },
    { table: "events", live_rows: "200000", seq_scan: "40", seq_rows_read: "8000000", idx_scan: "3" },
    { table: "users", live_rows: 5000, seq_scan: 10, seq_rows_read: 50000, idx_scan: 900 },
    { table: "logs", live_rows: 3000, seq_scan: 0, seq_rows_read: 0, idx_scan: null },
  ]);
  assert.deepEqual(rows.map((r) => r.table), ["events", "users", "logs"]);
  assert.deepEqual(rows[0], { table: "events", live_rows: 200000, seq_scan: 40, seq_rows_read: 8000000, idx_scan: 3, rows_per_seq_scan: 200000, flagged: true });
  assert.equal(rows[1].flagged, false, "index scan の方が多い");
  assert.equal(rows[2].rows_per_seq_scan, 0);
  assert.deepEqual(seqScanRows([{ table: "small", live_rows: 10, seq_scan: 1, seq_rows_read: 10, idx_scan: 0 }], { minRows: 0 }).map((r) => r.table), ["small"]);
});

test("splitMinRows: --min-rows=<n> を外す、無ければ undefined、整数でなければ throw", () => {
  assert.deepEqual(splitMinRows(["seqscans", "--min-rows=50"]), { args: ["seqscans"], minRows: 50 });
  assert.deepEqual(splitMinRows(["seqscans"]), { args: ["seqscans"], minRows: undefined });
  assert.throws(() => splitMinRows(["--min-rows=x"]), /0 以上の整数/);
});
