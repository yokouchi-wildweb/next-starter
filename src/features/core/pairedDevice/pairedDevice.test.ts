// src/features/core/pairedDevice/pairedDevice.test.ts
// DB を使わない純粋ロジックの検査（コードの正規化、scope の包含判定）

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatShortCode,
  generateShortCode,
  hashSecretToken,
  normalizeShortCode,
  SHORT_CODE_ALPHABET,
} from "@/lib/crypto/secretToken";
import { isValidScopePattern, scopeContains } from "@/features/core/pairedDevice/utils/scopeContains";

test("generateShortCode は指定の長さで文字集合内の文字だけを使う", () => {
  for (let i = 0; i < 100; i += 1) {
    const code = generateShortCode(8);
    assert.equal(code.length, 8);
    for (const char of code) assert.ok(SHORT_CODE_ALPHABET.includes(char));
  }
});

test("表示形・小文字・読み間違えやすい文字を入力しても同じコードとして照合できる", () => {
  const code = "AB01CD2E";
  const variants = [formatShortCode(code), "ab01cd2e", "AB0ICD2E", "ABO1CD2E", " ab-01 cd-2e "];
  for (const input of variants) {
    assert.equal(normalizeShortCode(input), code, input);
    assert.equal(hashSecretToken(normalizeShortCode(input)!), hashSecretToken(code));
  }
});

test("文字集合外の文字や空文字は null", () => {
  assert.equal(normalizeShortCode("ABCD-U123"), null);
  assert.equal(normalizeShortCode("ABC!"), null);
  assert.equal(normalizeShortCode(" - "), null);
});

test("scopeContains は JSONB の @> と同じ包含判定をする", () => {
  const scope = { storeId: "s1", tableId: "t3", tags: ["a", "b"], meta: { floor: 2 } };
  assert.ok(scopeContains(scope, {}));
  assert.ok(scopeContains(scope, { storeId: "s1" }));
  assert.ok(scopeContains(scope, { storeId: "s1", meta: { floor: 2 } }));
  assert.ok(scopeContains(scope, { tags: ["b"] }));
  assert.ok(!scopeContains(scope, { storeId: "s2" }));
  assert.ok(!scopeContains(scope, { storeId: "s1", tableId: "t4" }));
  assert.ok(!scopeContains(scope, { missing: "x" }));
  assert.ok(!scopeContains(scope, { tags: ["c"] }));
  assert.ok(!scopeContains(null, { storeId: "s1" }));
});

test("isValidScopePattern は全件に一致しかねないパターンを拒否する", () => {
  assert.ok(isValidScopePattern({ storeId: "s1" }));
  assert.ok(isValidScopePattern({ storeId: "s1", meta: { floor: 2 }, tags: ["a"] }));
  assert.ok(isValidScopePattern({ storeId: null }));
  assert.ok(!isValidScopePattern({}), "空オブジェクト");
  assert.ok(!isValidScopePattern({ storeId: undefined }), "undefined は JSON で消える");
  assert.ok(!isValidScopePattern({ storeId: "s1", tableId: undefined }), "一部 undefined");
  assert.ok(!isValidScopePattern({ meta: { floor: undefined } }), "ネストした undefined");
  assert.ok(!isValidScopePattern({ ids: [undefined] }), "配列内の undefined");
  assert.ok(!isValidScopePattern({ n: Number.NaN }), "NaN");
  assert.ok(!isValidScopePattern({ at: new Date() }), "Date");
  assert.ok(!isValidScopePattern(null));
  assert.ok(!isValidScopePattern(["s1"]));
  assert.ok(!isValidScopePattern("all"));
});
