// src/domains/core/userGroup/services/server/evaluation/compile.test.ts
// 条件の木 → SQL: and / or / not の入れ子をそのまま組む・1 回の評価で 1 つの now を全部の葉に渡す・
// 壊れた葉(部品が無い・引数が今の zod に合わない)は保存したグループ 409 / その場の定義 400
// 実行: pnpm test src/domains/core/userGroup
import { test } from "node:test";
import assert from "node:assert/strict";

import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { z } from "zod";

import { DomainError } from "@/lib/errors";

import type { UserGroupCriterion } from "../../../types/criterion";
import { compileUserGroupDefinition } from "./compile";

const seen: Date[] = [];
const criteria: Record<string, UserGroupCriterion> = {
  a: { key: "a", label: "A", args: z.object({ n: z.number() }).strict(), fields: [], weight: "cheap", where: ({ n }, { now }) => (seen.push(now), sql`a = ${n}`) },
  b: { key: "b", label: "B", args: z.object({}).strict(), fields: [], weight: "cheap", where: (_args, { now }) => (seen.push(now), sql`b`) },
};
const dialect = new PgDialect();
const NOW = new Date("2026-11-14T00:00:00.000Z");
const text = (tree: unknown, source: "stored" | "inline" = "inline") =>
  dialect.sqlToQuery(compileUserGroupDefinition(tree as never, { criteria, now: NOW, source }));

test("and / or / not の入れ子をそのまま組み、全部の葉に同じ now を渡す", () => {
  seen.length = 0;
  const { sql: query, params } = text({ op: "and", children: [{ part: "a", args: { n: 1 } }, { op: "or", children: [{ op: "not", child: { part: "b" } }, { part: "a", args: { n: 2 } }] }] });
  assert.equal(query, "(a = $1 and (not b or a = $2))");
  assert.deepEqual(params, [1, 2]);
  assert.equal(seen.length, 3);
  assert.ok(seen.every((date) => date === NOW));
});

test("壊れた葉: 保存したグループは 409、その場の定義は 400", () => {
  const cases: [unknown, RegExp][] = [
    [{ part: "nope" }, /部品 nope はありません/],
    [{ part: "a", args: { n: "x" } }, /条件「A」の値が今の形に合いません/],
  ];
  for (const [tree, pattern] of cases) {
    for (const [source, status] of [["stored", 409], ["inline", 400]] as const) {
      assert.throws(() => text(tree, source), (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.status, status);
        assert.match(error.message, pattern);
        if (source === "stored") assert.match(error.message, /条件が正しくありません/);
        return true;
      });
    }
  }
});
