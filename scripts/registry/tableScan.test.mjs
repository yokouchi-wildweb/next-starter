// scripts/registry/tableScan.test.mjs
// 表の走査(./tableScan.mjs)の回帰テスト。
// - 実リポ: 走査の表の集合 = schemaRegistry の全 pgTable 名(走査の漏れ・schemaRegistry の登録漏れの両方で止まる)
// - 字面で読めない pgTable は problems、フォルダの表はフォルダの下の全ファイルから
// 実行: pnpm test:schema-registry(tsx: schemaRegistry.ts を読むため)

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";

import { scanFeatureTables, tablesOfFolder } from "./tableScan.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
// schemaRegistry は `export *` の再 export だけなので require で全 export を得る(db:push と同じ)
const schema = createRequire(import.meta.url)("../../src/registry/schemaRegistry.ts");

test("実リポ: 走査の表の集合 = schemaRegistry の全 pgTable", () => {
  const { tables, problems } = scanFeatureTables(ROOT);
  assert.deepEqual(problems, [], problems.join("\n"));
  const scanned = [...new Set(tables.map((table) => table.name))].sort();
  const registered = [
    ...new Set(
      Object.values(schema)
        .filter((value) => is(value, PgTable))
        .map((table) => getTableName(table)),
    ),
  ].sort();
  assert.deepEqual(
    scanned.filter((name) => !registered.includes(name)),
    [],
    "src/features にあるが schemaRegistry から届かない表(登録漏れ)",
  );
  assert.deepEqual(
    registered.filter((name) => !scanned.includes(name)),
    [],
    "schemaRegistry にあるが走査で拾えない表(走査の範囲の外)",
  );
  assert.equal(tables.length, scanned.length, "同じ表名の pgTable が 2 か所にある");
});

test("走査: 改行をはさむ呼び出し・フォルダの下の全ファイルを拾い、字面で読めない名前は problems", () => {
  const root = mkdtempSync(join(tmpdir(), "table-scan-"));
  const dir = join(root, "src/features/core/foo");
  mkdirSync(join(dir, "entities"), { recursive: true });
  mkdirSync(join(dir, "generated/x"), { recursive: true });
  writeFileSync(join(dir, "entities/drizzle.ts"), 'import { pgTable } from "drizzle-orm/pg-core";\nexport const A = pgTable("foos", {});\nexport const B = pgTable(\n  "foo_items",\n  {},\n);\n');
  writeFileSync(join(dir, "generated/x/drizzle.ts"), 'export const C = pgTable("foo_x", {});\n');
  writeFileSync(join(dir, "types.ts"), '/**\n * @example\n * export const T = pgTable("example_only", {});\n */\n// pgTable("line_comment", {})\nexport type X = 1;\n');
  writeFileSync(join(dir, "entities/bad.ts"), "const NAME = \"z\";\nexport const D = pgTable(NAME, {});\n");
  writeFileSync(join(dir, "entities/drizzle.test.ts"), 'export const E = pgTable("ignored", {});\n');
  mkdirSync(join(root, "src/features/core/fooBar"), { recursive: true });
  writeFileSync(join(root, "src/features/core/fooBar/drizzle.ts"), 'export const F = pgTable("foo_bars", {});\n');

  const { tables, problems } = scanFeatureTables(root);
  assert.deepEqual(tablesOfFolder(tables, "core/foo").sort(), ["foo_items", "foo_x", "foos"]);
  assert.deepEqual(tablesOfFolder(tables, "core/fooBar"), ["foo_bars"], "前方一致はフォルダの区切りで(core/foo は core/fooBar を含まない)");
  assert.equal(problems.length, 1);
  assert.match(problems[0], /bad\.ts/);
});
