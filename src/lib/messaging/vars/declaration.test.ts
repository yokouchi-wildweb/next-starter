// src/lib/messaging/vars/declaration.test.ts
// 管理者が入れる値の入力の型の変換(adminVarValueOf、連絡定義の adminVars)の回帰テスト。
// 実行: pnpm test src/lib/messaging/vars/declaration.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";

import { adminVarValueOf } from "./declaration";

test("adminVarValueOf: 入力の型で変換する(数は数、ほかは型の形の字)", () => {
  assert.deepEqual(adminVarValueOf({ type: "number" }, " 12 "), { value: 12 });
  assert.deepEqual(adminVarValueOf({ type: "number" }, 3.5), { value: 3.5 });
  assert.deepEqual(adminVarValueOf({ type: "date" }, "2026-12-01"), { value: "2026-12-01" });
  assert.deepEqual(adminVarValueOf({ type: "line" }, "こんにちは"), { value: "こんにちは" });
  assert.deepEqual(adminVarValueOf({ type: "select", options: [{ value: "a", label: "A" }] }, "a"), { value: "a" });
});

test("adminVarValueOf: 空は既定値、既定値も無ければ undefined", () => {
  assert.deepEqual(adminVarValueOf({ type: "number", default: 5 }, ""), { value: 5 });
  assert.deepEqual(adminVarValueOf({ type: "line" }, null), { value: undefined });
});

test("adminVarValueOf: 型の形でなければ problem", () => {
  assert.ok("problem" in adminVarValueOf({ type: "number" }, "十二"));
  assert.ok("problem" in adminVarValueOf({ type: "date" }, "2026-13-01"));
  assert.ok("problem" in adminVarValueOf({ type: "select", options: [{ value: "a", label: "A" }] }, "b"));
  assert.ok("problem" in adminVarValueOf({ type: "line" }, "1 行目\n2 行目"));
});
