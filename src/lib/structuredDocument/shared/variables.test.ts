// src/lib/structuredDocument/shared/variables.test.ts
//
// 差し込みの 1 本(replaceVariables・listVariables)の検査。実行: pnpm test src/lib/structuredDocument
import { test } from "node:test";
import assert from "node:assert/strict";

import { listVariables, replaceVariables, replaceVariablesInArray } from "./variables";

test("replaceVariables: 知っている鍵だけ差し込み、知らない鍵と点を含む鍵は残す", () => {
  assert.equal(
    replaceVariables("{{A}} と {{B}} と {{a.b}}", { A: "あ" }),
    "あ と {{B}} と {{a.b}}",
  );
  assert.deepEqual(replaceVariablesInArray(["{{A}}", "x"], { A: "1" }), ["1", "x"]);
});

test("listVariables: 出てくる順に重複なし、点を含む鍵は拾わない", () => {
  assert.deepEqual(listVariables("{{NAME}} 様、{{SERVICE}} です。{{NAME}} {{a.b}}"), ["NAME", "SERVICE"]);
  assert.deepEqual(listVariables("差し込みなし"), []);
});

test("listVariables の後でも replaceVariables は全部差し込む(正規表現の lastIndex を持ち越さない)", () => {
  listVariables("{{A}} {{B}}");
  assert.equal(replaceVariables("{{A}}{{B}}", { A: "1", B: "2" }), "12");
});
