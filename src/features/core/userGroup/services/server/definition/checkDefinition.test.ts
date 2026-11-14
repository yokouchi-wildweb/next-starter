// src/features/core/userGroup/services/server/definition/checkDefinition.test.ts
// 条件の定義の木の検査: and / or / not の任意の深さ、節の数・深さの上限、知らない部品の鍵・引数の誤りは DomainError(400)、heavy を返す
// 実行: pnpm test src/features/core/userGroup
import { test } from "node:test";
import assert from "node:assert/strict";

import { sql } from "drizzle-orm";
import { z } from "zod";

import { DomainError } from "@/lib/errors";

import type { UserGroupCriterion } from "../../../types/criterion";
import { checkUserGroupDefinition } from "./checkDefinition";

const criteria: Record<string, UserGroupCriterion> = {
  registeredDays: {
    key: "registeredDays",
    label: "登録からの日数",
    args: z.object({ min: z.number().int().min(0) }).strict(),
    fields: [{ name: "min", label: "何日以上", formInput: "numberInput" }],
    weight: "cheap",
    where: (args) => sql`true or ${args.min} > 0`,
  },
  purchasedTotal: {
    key: "purchasedTotal",
    label: "購入の合計",
    args: z.object({ amount: z.number() }).strict(),
    fields: [],
    weight: "heavy",
    where: () => sql`true`,
  },
};
const limits = { maxNodes: 50, maxDepth: 6 };
const check = (tree: unknown, l = limits) => checkUserGroupDefinition(tree, { criteria, limits: l });

async function rejects400(run: () => unknown, pattern?: RegExp) {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof DomainError);
    assert.equal(error.status, 400);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
}

const cheap = { part: "registeredDays", args: { min: 30 } };
const heavy = { part: "purchasedTotal", args: { amount: 1000 } };

test("葉 1 つ・and / or / not の入れ子は通り、節の数・深さ・使った部品を返す", () => {
  assert.deepEqual(check(cheap), { heavy: false, nodes: 1, depth: 1, parts: ["registeredDays"] });
  const tree = { op: "and", children: [cheap, { op: "or", children: [{ op: "not", child: cheap }, cheap] }] };
  assert.deepEqual(check(tree), { heavy: false, nodes: 6, depth: 4, parts: ["registeredDays"] });
});

test("heavy の部品を含めば heavy: true(深い所にあっても)", () => {
  const tree = { op: "or", children: [cheap, { op: "not", child: { op: "and", children: [heavy] } }] };
  const result = check(tree);
  assert.equal(result.heavy, true);
  assert.deepEqual(result.parts, ["registeredDays", "purchasedTotal"]);
});

test("形の誤り(知らない op・空の children・余分な鍵・not の子なし)は 400", async () => {
  for (const tree of [
    { op: "xor", children: [cheap] },
    { op: "and", children: [] },
    { op: "and", children: [cheap], extra: 1 },
    { op: "not" },
    { part: "" },
    null,
    "registeredDays",
  ]) {
    await rejects400(() => check(tree), /条件の定義の形/);
  }
});

test("知らない部品の鍵・引数の zod の誤りは 400(どの節か言う)", async () => {
  await rejects400(() => check({ op: "and", children: [cheap, { part: "nope" }] }), /部品 nope はありません\(根\.children\.1\)/);
  await rejects400(() => check({ part: "registeredDays", args: { min: -1 } }), /登録からの日数.*根\.args\.min/);
  await rejects400(() => check({ part: "registeredDays" }), /登録からの日数/);
});

test("節の数と深さの上限(設定の値)", async () => {
  const wide = { op: "or", children: Array.from({ length: 5 }, () => cheap) };
  assert.equal(check(wide, { maxNodes: 6, maxDepth: 6 }).nodes, 6);
  await rejects400(() => check(wide, { maxNodes: 5, maxDepth: 6 }), /節は 5 個まで/);
  let deep: unknown = cheap;
  for (let i = 0; i < 6; i += 1) deep = { op: "not", child: deep };
  assert.equal(check(deep, { maxNodes: 50, maxDepth: 7 }).depth, 7);
  await rejects400(() => check(deep), /深さは 6 段まで/);
});
