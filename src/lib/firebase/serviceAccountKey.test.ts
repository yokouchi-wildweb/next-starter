// src/lib/firebase/serviceAccountKey.test.ts
// 鍵の JSON の正規化: 文字列の外の空白・改行を除き、壊れた入力の誤りの文に入力の値(JSON.parse の引用も)を出さないこと
import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeJsonString } from "./serviceAccountKey";

test("文字列の外の空白・改行を除き、文字列の中は保つ", () => {
  assert.equal(normalizeJsonString('{\r\n  "a": "x y\\n",\n  "b": 1\n}'), '{"a":"x y\\n","b":1}');
});

test("壊れた入力の誤りの文に入力の値を出さない", () => {
  const marker = "SECRET_MARKER_7c1d";
  assert.throws(
    () => normalizeJsonString(`{"private_key": "${marker}", broken`),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.ok(!error.message.includes(marker), error.message);
      assert.ok(!error.message.includes("SECRET"), error.message);
      assert.match(error.message, /JSON/);
      return true;
    },
  );
});
