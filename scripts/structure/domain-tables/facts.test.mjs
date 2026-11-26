// 照らしの部品(facts.mjs・tables.mjs)の検査。実行: pnpm test scripts/structure/domain-tables/facts.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { diffTableFacts, tableFactsOf } from "./facts.mjs";
import { actualTable, expectedTable, makeTempDir } from "./tables.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const tempDir = makeTempDir();
after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

const parents = pgTable("parents", { id: uuid("id").primaryKey() });

/** 比べる 2 つの表を同じ形から作る(variant で 1 か所ずつ変える) */
function makeTable(variant = {}) {
  return pgTable(
    "children",
    {
      id: uuid("id").defaultRandom().primaryKey(),
      parentId: uuid("parent_id"),
      amount: variant.amountType === "text" ? text("amount") : integer("amount"),
      label: variant.labelNullable ? text("label") : text("label").notNull(),
      createdAt: variant.noDefault ? timestamp("created_at", { withTimezone: true }) : timestamp("created_at", { withTimezone: true }).defaultNow(),
    },
    (table) => [
      foreignKey({ name: "children_parent_fk", columns: [table.parentId], foreignColumns: [parents.id] }).onDelete(variant.onDelete ?? "cascade"),
      index("children_created_idx").on(variant.asc ? table.createdAt : table.createdAt.desc()),
      check("children_amount_check", sql.raw(variant.check ?? "amount > 0")),
    ],
  );
}

test("同じ形の表は違い 0", () => {
  assert.deepEqual(diffTableFacts(tableFactsOf(makeTable()), tableFactsOf(makeTable())), []);
});

test("型・NOT NULL・既定・FK の onDelete・索引の向き・check の違いを 1 行ずつ出す", () => {
  const base = tableFactsOf(makeTable());
  const cases = [
    [{ amountType: "text" }, /^children: 列 amount の型: 宣言 integer \/ 今 text$/],
    [{ labelNullable: true }, /^children: 列 label の NOT NULL: 宣言 true \/ 今 false$/],
    [{ noDefault: true }, /^children: 列 created_at の既定: 宣言 now\(\) \/ 今 null$/],
    [{ onDelete: "set null" }, /^children: FK children_parent_fk: 宣言 .*"onDelete":"cascade".* \/ 今 .*"onDelete":"set null"/],
    [{ asc: true }, /^children: 索引 children_created_idx: 宣言 .*created_at desc.* \/ 今 .*"created_at"/],
    [{ check: "amount >= 0" }, /^children: check children_amount_check: 宣言 amount > 0 \/ 今 amount >= 0$/],
  ];
  for (const [variant, pattern] of cases) {
    const lines = diffTableFacts(base, tableFactsOf(makeTable(variant)));
    assert.equal(lines.length, 1, `${JSON.stringify(variant)}: ${lines.join(" | ")}`);
    assert.match(lines[0], pattern);
  }
});

test("片方だけの列は「なし」で出す", () => {
  const extra = pgTable("children", { id: uuid("id").primaryKey(), note: text("note") });
  const lines = diffTableFacts(tableFactsOf(pgTable("children", { id: uuid("id").primaryKey() })), tableFactsOf(extra));
  assert.ok(lines.includes("children: 列 note の型: 宣言 なし / 今 text"), lines.join(" | "));
});

test("sampleTag の domain.json を宣言として生成器で組んだ表と、今の SampleTagTable の違いが 0", async () => {
  const config = JSON.parse(fs.readFileSync(path.join(repoRoot, "src", "domains", "sampleTag", "domain.json"), "utf8"));
  const registration = { domain: "sampleTag", registration: "sampleTag", dir: "src/domains/sampleTag", domainDir: "src/domains/sampleTag", config, table: "sample_tags", problems: [] };
  const expected = await expectedTable(repoRoot, registration, tempDir);
  const actual = await actualTable(repoRoot, "sample_tags");
  assert.ok(actual);
  assert.notEqual(expected, actual);
  assert.deepEqual(diffTableFacts(tableFactsOf(expected), tableFactsOf(actual)), []);
});
