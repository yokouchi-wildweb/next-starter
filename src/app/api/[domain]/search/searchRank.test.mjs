// src/app/api/[domain]/search/searchRank.test.mjs
// search ルートの searchRank パラメータのパーサ（fail-closed）のテスト。並べ方の SQL は src/lib/crud/drizzle/query/searchRank.test.mjs。
// 実行: pnpm test src/app/api/[domain]/search/searchRank.test.mjs （node:test + Node 組み込みの TypeScript type stripping）
import { test } from "node:test";
import assert from "node:assert/strict";

import { parseSearchRank, BadRequestError } from "./utils.ts";

test("parseSearchRank: boolean 表記", () => {
  assert.equal(parseSearchRank(null), undefined);
  assert.equal(parseSearchRank(""), undefined);
  assert.equal(parseSearchRank("true"), true);
  assert.equal(parseSearchRank("1"), true);
  assert.equal(parseSearchRank("false"), false);
  assert.equal(parseSearchRank("0"), false);
});

test("parseSearchRank: JSON spec を受理し正規化する", () => {
  assert.deepEqual(parseSearchRank('{"fields":["name",{"field":"email","weight":2},{"field":" phoneNumber "}]}'), {
    fields: ["name", { field: "email", weight: 2 }, { field: "phoneNumber" }],
  });
  assert.equal(parseSearchRank("{}"), true);
});

test("parseSearchRank: 不正入力は 400 相当の BadRequestError", () => {
  const bad = [
    "yes",
    "[1]",
    '{"fields":"name"}',
    '{"fields":[""]}',
    '{"fields":[{"field":"name","weight":0}]}',
    '{"fields":[{"field":"name","weight":101}]}',
    '{"fields":[{"field":"name","weight":"3"}]}',
    '{"fields":[{"field":"name","sql":"1"}]}',
    '{"fields":["name"],"tieBreak":[]}',
    '{"fields":[1]}',
    `{"fields":${JSON.stringify(Array.from({ length: 21 }, (_, i) => `f${i}`))}}`,
  ];
  for (const input of bad) {
    assert.throws(() => parseSearchRank(input), BadRequestError, `should reject: ${input}`);
  }
});
