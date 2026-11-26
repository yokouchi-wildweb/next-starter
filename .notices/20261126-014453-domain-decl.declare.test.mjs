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
import { UserTable } from "../src/domains/core/user/entities/user/drizzle.ts";
import { accessOfDeclaration } from "../scripts/structure/registry/serviceRegistry/access.mjs";
import { declareTable, skipReasonOf } from "./20261126-014453-domain-decl.declare.mjs";

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
  assert.deepEqual(column("seq"), { type: "bigint", notNull: true, identity: "always" }, "identity の列は関数の既定と取り違えない(identity の列は NOT NULL)");
  assert.deepEqual(column("code"), { type: "text", unique: true });
  assert.deepEqual(entity.enums, [{ name: "dt_widget_kind", values: ["a", "b"] }]);
  assert.deepEqual(entity.indexes.find((i) => i.name === "dt_widgets_seen_idx"), { name: "dt_widgets_seen_idx", fields: ["seenAt"], desc: ["seenAt"] });
  assert.ok(entity.indexes.some((i) => i.name === "dt_widgets_name_lower_idx" && /lower/.test(i.expression)));
  assert.deepEqual(entity.checks, [{ name: "dt_widgets_rank_check", sql: "rank >= 0" }]);
  assert.equal(entity.columns.some((c) => c.name === "createdAt"), false, "システム列は useCreatedAt のまま");
  assert.deepEqual(result.discrepancies, [], "宣言の無い表は食い違いの行を出さない");
});

test("1 ファイルの宣言から起こすと、足した列・索引を「動いている値で書いた」行に出す", async () => {
  // 起こす元 = 1 ファイルの宣言の形(上流はもう短い形なので、登録の entity.json にドメインの label を足して組む)
  const label = JSON.parse(fs.readFileSync(path.join(repoRoot, "src", "domains", "sampleTag", "domain.json"), "utf8")).label;
  const base = { ...JSON.parse(fs.readFileSync(path.join(repoRoot, "src", "domains", "sampleTag", "entities", "sampleTag", "entity.json"), "utf8")), label };
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

test("fork でだけ出た形: 外部キーの無い関連・NOT NULL の関連・値の増えた enum・型の表に無い fieldType", async () => {
  const userRelation = { domain: "user", label: "ユーザー", fieldName: "user_id", fieldType: "uuid", relationType: "belongsTo" };
  const ownerRelation = { domain: "user", label: "持ち主", fieldName: "owner_id", fieldType: "uuid", relationType: "belongsTo" };
  const statusEnum = pgEnum("dtLink_status_enum", ["a", "b", "c"]);
  const actual = pgTable("dt_links", {
    id: uuid("id").defaultRandom().primaryKey(),
    user_id: uuid("user_id"),
    owner_id: uuid("owner_id").notNull().references(() => UserTable.id),
    status: statusEnum("status"),
    ids: uuid("ids").array(),
  });
  const base = {
    plural: "dt_links", dbEngine: "Neon", idType: "uuid", generate: false,
    relations: [userRelation, ownerRelation],
    fields: [
      { name: "status", label: "状態", fieldType: "enum", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] },
      { name: "ids", label: "ID", fieldType: "uuid[]" },
    ],
  };
  const result = await declareTable({ ...input(actual, base, true), registration: "dtLink", domain: "dtLink", domainDir: "src/domains/dtLink" });
  assert.deepEqual(result.stops, []);
  const relation = (name) => result.entity.relations.find((rel) => rel.fieldName === name);
  assert.equal(relation("user_id").foreignKey, false, "外部キーの無い関連");
  assert.equal(relation("owner_id").required, true, "今は NOT NULL の関連");
  assert.equal(relation("owner_id").foreignKey, false, "onDelete が no action の外部キーは関連の鍵で書けないので名前つきの foreignKeys");
  assert.deepEqual(result.entity.foreignKeys, [{ columns: ["owner_id"], references: { table: "users", columns: ["id"] }, name: "dt_links_owner_id_users_id_fk" }]);
  const field = (name) => result.entity.fields.find((f) => f.name === name);
  assert.equal(field("status").column.enum, "dtLink_status_enum");
  assert.deepEqual(result.entity.enums, [{ name: "dtLink_status_enum", values: ["a", "b", "c"] }]);
  assert.deepEqual(field("status").options, base.fields[0].options, "宣言の options はそのまま");
  assert.deepEqual(field("ids").column, { type: "uuid[]" });
  assert.ok(result.discrepancies.some((line) => /user_id の外部キーは今の表に無い/.test(line)));
  assert.ok(result.discrepancies.some((line) => /owner_id の NOT NULL/.test(line)));
  assert.ok(result.discrepancies.some((line) => /enum dtLink_status_enum の値を今の値で書いた/.test(line)));
  assert.ok(result.discrepancies.some((line) => /fieldType "uuid\[\]" は型の表に無い/.test(line)));
});

test("core のドメインと、既に宣言の形(domain.json 2.0 + entities/<登録名>/entity.json)のドメインは起こさない(上流の宣言を上書きしない)", () => {
  const root = fs.mkdtempSync(path.join(tempDir, "skip-"));
  const put = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  put("src/domains/core/coupon/domain.json", '{ "domainConfigVersion": "2.0", "label": "クーポン" }\n');
  put("src/domains/sample/domain.json", '{ "domainConfigVersion": "2.0", "label": "サンプル" }\n');
  put("src/domains/sample/entities/sample/entity.json", "{}\n");
  put("src/domains/game/domain.json", '{ "label": "ゲーム", "singular": "game" }\n');
  put("src/domains/half/domain.json", '{ "domainConfigVersion": "2.0", "label": "途中" }\n');
  assert.match(skipReasonOf(root, { name: "coupon", dir: "src/domains/core/coupon", core: true }), /core/);
  assert.match(skipReasonOf(root, { name: "sample", dir: "src/domains/sample", core: false }), /既に宣言の形/);
  assert.equal(skipReasonOf(root, { name: "game", dir: "src/domains/game", core: false }), null, "1 ファイルの宣言は起こす");
  assert.equal(skipReasonOf(root, { name: "half", dir: "src/domains/half", core: false }), null, "2.0 でも entity.json が無ければ起こす");
});
