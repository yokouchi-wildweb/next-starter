// scripts/operations/db/inspect.test.ts — pnpm test scripts/operations/db/inspect.test.ts
// pnpm ops db inspect の純粋な部品: --json の旗の外し方と、行の JSON(表の出力は今のまま、DB には繋がない)

import assert from "node:assert/strict";
import { test } from "node:test";

import { rowsAsJson, splitJsonFlag } from "./lib.inspect";

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
