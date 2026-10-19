// withIdTiebreak（ORDER BY 末尾の id による並べ分け）の契約テスト。
// 実行: pnpm test:crud-search-rank （node:test + Node 組み込みの TypeScript type stripping）
import { test } from "node:test";
import assert from "node:assert/strict";
import { asc, desc, sql } from "drizzle-orm";
import { pgTable, text, integer, PgDialect } from "drizzle-orm/pg-core";

import { withIdTiebreak } from "./withIdTiebreak.ts";

const dialect = new PgDialect();
const toSql = (clauses) => dialect.sqlToQuery(sql.join(clauses, sql`, `)).sql;

const Items = pgTable("items", {
  id: text("id").primaryKey(),
  name: text("name"),
  sortOrder: integer("sort_order"),
});
const NoIdTable = pgTable("logs", { key: text("key"), value: text("value") });

test("orderBy に id が無ければ末尾に asc(id) を足す", () => {
  const clauses = withIdTiebreak(Items, [["sortOrder", "DESC"]], [desc(Items.sortOrder)]);
  assert.equal(toSql(clauses), '"items"."sort_order" desc, "items"."id" asc');
});

test("orderBy 未指定でも id で閉じる(先頭の rank 句などはそのまま残す)", () => {
  const rank = sql`(score) DESC`;
  const clauses = withIdTiebreak(Items, undefined, [rank]);
  assert.equal(toSql(clauses), '(score) DESC, "items"."id" asc');
});

test("orderBy に id が含まれていれば足さない", () => {
  const clauses = withIdTiebreak(Items, [["id", "DESC"]], [desc(Items.id)]);
  assert.equal(toSql(clauses), '"items"."id" desc');
});

test("id カラムの無いテーブルでは何も足さない", () => {
  const clauses = withIdTiebreak(NoIdTable, [["key", "ASC"]], [asc(NoIdTable.key)]);
  assert.equal(toSql(clauses), '"logs"."key" asc');
});

test("渡した配列は書き換えない(新しい配列を返す)", () => {
  const input = [asc(Items.name)];
  const out = withIdTiebreak(Items, [["name", "ASC"]], input);
  assert.equal(input.length, 1);
  assert.equal(out.length, 2);
});
