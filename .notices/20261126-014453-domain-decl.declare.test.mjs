// .notices/20261126-014453-domain-decl.declare.mjs の検査(表は記憶の中で作り、宣言から組む生成器はこのリポジトリの物)。
// 実行: pnpm test .notices/20261126-014453-domain-decl.declare.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { sql } from "drizzle-orm";
import { bigint, check, index, inet, jsonb, pgEnum, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { makeTempDir } from "../scripts/structure/domain-tables/tables.mjs";
import { accessOfDeclaration, declareTable } from "./20261126-014453-domain-decl.declare.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const thisFile = path.relative(repoRoot, fileURLToPath(import.meta.url)).split(path.sep).join("/");
const tempDir = makeTempDir();
after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

const kind = pgEnum("dt_widget_kind", ["a", "b"]);
const widgets = pgTable(
  "dt_widgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    rank: smallint("rank").notNull().default(0),
    ip: inet("ip"),
    meta: jsonb("meta").notNull().default(sql`'{}'::jsonb`),
    kind: kind("kind").notNull(),
    parentId: uuid("parent_id"),
    seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
    seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity(),
    code: text("code").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("dt_widgets_seen_idx").on(table.seenAt.desc()),
    index("dt_widgets_name_lower_idx").on(sql`lower(${table.name})`),
    check("dt_widgets_rank_check", sql`rank >= 0`),
  ],
);

const input = (actual, base, fromOld = false) => ({
  repoRoot, registration: "dtWidget", domain: "dtWidget", domainDir: "src/domains/dtWidget", tableFile: thisFile, actual, base, fromOld, tempDir,
});

test("手で持つ表(宣言なし)は今の表から起こし、照らしの差 0 で返す", async () => {
  const base = { plural: "dt_widgets", dbEngine: "Neon", fields: [], generate: false, idType: "uuid", useCreatedAt: true };
  const result = await declareTable(input(widgets, base));
  assert.deepEqual(result.stops, []);
  const entity = result.entity;
  assert.ok(entity);
  assert.equal(entity.fields, undefined, "宣言の無い表の列は全部 表だけの列(columns)");
  const column = (name) => entity.columns.find((c) => c.name === name)?.column;
  assert.deepEqual(column("rank"), { type: "smallint", notNull: true, default: 0 });
  assert.deepEqual(column("ip"), { type: "inet" });
  assert.deepEqual(column("meta"), { type: "jsonb", notNull: true, default: { sql: "'{}'::jsonb" } });
  assert.deepEqual(column("kind"), { enum: "dt_widget_kind", notNull: true });
  assert.deepEqual(column("seq"), { type: "bigint", identity: "always" }, "identity の列は関数の既定と取り違えない");
  assert.deepEqual(column("code"), { type: "text", unique: true });
  assert.deepEqual(entity.enums, [{ name: "dt_widget_kind", values: ["a", "b"] }]);
  assert.deepEqual(entity.indexes.find((i) => i.name === "dt_widgets_seen_idx"), { name: "dt_widgets_seen_idx", fields: ["seenAt"], desc: ["seenAt"] });
  assert.ok(entity.indexes.some((i) => i.name === "dt_widgets_name_lower_idx" && /lower/.test(i.expression)));
  assert.deepEqual(entity.checks, [{ name: "dt_widgets_rank_check", sql: "rank >= 0" }]);
  assert.equal(entity.columns.some((c) => c.name === "createdAt"), false, "システム列は useCreatedAt のまま");
  assert.deepEqual(result.discrepancies, [], "宣言の無い表は食い違いの行を出さない");
});

test("1 ファイルの宣言から起こすと、足した列・索引を「動いている値で書いた」行に出す", async () => {
  const old = JSON.parse(fs.readFileSync(path.join(repoRoot, "src", "domains", "sampleTag", "domain.json"), "utf8"));
  const { domainConfigVersion: _v, ...base } = old;
  const actual = pgTable(
    "sample_tags",
    {
      id: uuid("id").defaultRandom().primaryKey(),
      name: text("name").notNull(),
      description: text("description"),
      extra: text("extra"),
      createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    },
    (table) => [index("sample_tags_extra_idx").on(table.extra)],
  );
  const result = await declareTable({ ...input(actual, base, true), registration: "sampleTag", domain: "sampleTag", domainDir: "src/domains/sampleTag" });
  assert.deepEqual(result.stops, []);
  assert.equal(result.entity.fields.some((f) => f.name === "extra"), false, "宣言に無かった列は項目にしない(表示の写しを変えない)");
  assert.deepEqual(result.entity.columns, [{ name: "extra", column: { type: "text" } }]);
  assert.deepEqual(result.discrepancies, ["sample_tags: 列 extra を表だけの列 extra として足した(宣言に無かった)", "sample_tags: 索引 sample_tags_extra_idx を今の値で書いた"]);
});

test("宣言に書けない形(関数の既定)は書かずに止める", async () => {
  const actual = pgTable("dt_fn_defaults", { id: uuid("id").defaultRandom().primaryKey(), token: text("token").$defaultFn(() => "x") });
  const result = await declareTable(input(actual, { plural: "dt_fn_defaults", dbEngine: "Neon", fields: [], generate: false, idType: "uuid" }));
  assert.equal(result.entity, null);
  assert.match(result.stops[0], /既定が関数\(\$defaultFn\)で宣言に書けない/);
});

test("登録の access: 手で持つ登録は apiAccess をそのまま、生成する登録は既定に書いた鍵を重ねる", () => {
  const internal = { read: "none", write: "none" };
  assert.deepEqual(accessOfDeclaration({ generate: false, apiAccess: internal }), internal);
  assert.deepEqual(accessOfDeclaration({}).operations, { truncateAll: { roleCategories: ["admin"] }, export: "none", import: "none" });
  assert.deepEqual(accessOfDeclaration({ apiAccess: { ...internal, operations: { truncateAll: "none" } } }).operations.truncateAll, "none");
  assert.equal(accessOfDeclaration({ useImportExport: true }).operations.export.roleCategories[0], "admin");
});
