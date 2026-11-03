// src/lib/crud/firestore/query/applyWhere.test.ts
//
// Firestore の where の読み替えの検査（実 Firestore 不要）。where 呼び出しを記録する偽の Query を渡す。
// 対応する演算子は Firestore の where に写り、未対応の演算子は例外になる（黙って条件を捨てない）こと。
// 実行: pnpm test:crud-firestore-where
import { test } from "node:test";
import assert from "node:assert/strict";

import type { QueryOp, WhereExpr } from "@/lib/crud/types";
import { applyWhere } from "./applyWhere";

type Call = [string, string, unknown];

const fakeQuery = (calls: Call[] = []): FirebaseFirestore.Query => {
  const q = {
    where(field: string, op: string, value: unknown) {
      calls.push([field, op, value]);
      return q;
    },
  };
  return q as unknown as FirebaseFirestore.Query;
};

const run = (expr: WhereExpr): Call[] => {
  const calls: Call[] = [];
  applyWhere(fakeQuery(calls), expr);
  return calls;
};

test("対応する演算子は Firestore の where に写る", () => {
  assert.deepEqual(run({ field: "a", op: "eq", value: 1 }), [["a", "==", 1]]);
  assert.deepEqual(run({ field: "a", op: "ne", value: 1 }), [["a", "!=", 1]]);
  assert.deepEqual(run({ field: "a", op: "lt", value: 1 }), [["a", "<", 1]]);
  assert.deepEqual(run({ field: "a", op: "lte", value: 1 }), [["a", "<=", 1]]);
  assert.deepEqual(run({ field: "a", op: "gt", value: 1 }), [["a", ">", 1]]);
  assert.deepEqual(run({ field: "a", op: "gte", value: 1 }), [["a", ">=", 1]]);
  assert.deepEqual(run({ field: "a", op: "like", value: "ab" }), [
    ["a", ">=", "ab"],
    ["a", "<=", "ab"],
  ]);
});

test("and は各条件を順に重ねる", () => {
  assert.deepEqual(
    run({ and: [{ field: "a", op: "eq", value: 1 }, { field: "b", op: "gt", value: 2 }] }),
    [
      ["a", "==", 1],
      ["b", ">", 2],
    ],
  );
});

test("条件なしはそのまま返す", () => {
  const q = fakeQuery();
  assert.equal(applyWhere(q, undefined), q);
});

const UNSUPPORTED: QueryOp[] = [
  "startsWith",
  "endsWith",
  "in",
  "notIn",
  "isNull",
  "isNotNull",
  "contains",
  "containedBy",
  "hasKey",
  "arrayContains",
  "arrayOverlaps",
];

for (const op of UNSUPPORTED) {
  test(`未対応の演算子 ${op} は例外（条件を黙って捨てない）`, () => {
    assert.throws(
      () => applyWhere(fakeQuery(), { field: "a", op, value: [1] } as WhereExpr),
      new RegExp(`does not support where operator "${op}"`),
    );
  });
}

test("and の中の未対応の演算子も例外", () => {
  assert.throws(
    () =>
      applyWhere(fakeQuery(), {
        and: [{ field: "a", op: "eq", value: 1 }, { field: "b", op: "in", value: [1, 2] }],
      }),
    /does not support where operator "in"/,
  );
});

test("or は従来どおり例外", () => {
  assert.throws(() => applyWhere(fakeQuery(), { or: [{ field: "a", op: "eq", value: 1 }] }), /OR/);
});
