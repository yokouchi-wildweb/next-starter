// pnpm generate domain の entities/drizzle.ts: 手で持つ表の形の鍵(table・primaryKey・foreignKeys・checks・enums・fields[].column、
// indexes の unique・desc・expression。render/entities/drizzle/shape.mjs・indexes.mjs)の出力と、鍵の無い時に今の出力のままか。
// 実行: pnpm test scripts/structure/domain/tests/drizzleShape.test.mjs
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { renderDrizzleEntity } from "../render/entities/drizzle/index.mjs";
import { ENTITY_KINDS, moveIntoRegistration } from "../render/entities/collector.mjs";
import { renderEntities } from "../render/entities/index.mjs";
import { contextFor, makeProject, removeAll, repoRoot } from "./helpers.mjs";

const baseConfig = JSON.parse(fs.readFileSync(path.join(repoRoot, "src", "domains", "sampleTag", "entities", "sampleTag", "entity.json"), "utf8"));
const cleanup = [];
after(() => removeAll(cleanup));

/** sampleTag の config に鍵を足して生成し、本文か例外を返す */
function generate(extra, { files = {} } = {}) {
  const config = { ...baseConfig, ...extra };
  const root = makeProject({ configs: { sampleTag: config }, cleanup });
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  const { workspace, ctx } = contextFor(root, "sampleTag");
  try {
    return { output: renderDrizzleEntity(ctx, workspace), error: null };
  } catch (error) {
    return { output: null, error };
  }
}

test("鍵の無い config は sampleTag の今の生成物と同じ", () => {
  const { output, error } = generate({});
  assert.equal(error, null);
  // 生成の印の行(2 行目)は書き出しの時に足される(render の外)ので除いて比べる。本体は登録のフォルダ entities/sampleTag/drizzle.ts
  // (renderEntities が moveIntoRegistration で移す)
  const generated = fs.readFileSync(path.join(repoRoot, "src", "domains", "sampleTag", "entities", "sampleTag", "drizzle.ts"), "utf8");
  const moved = moveIntoRegistration(output, { domainRel: "src/domains/sampleTag", registration: "sampleTag", kind: "drizzle", siblings: ENTITY_KINDS });
  assert.equal(moved, generated.replace(/^(.*\n)\/\/ AUTO-GENERATED[^\n]*\n/, "$1"));
});

test("table は表の物理名、primaryKey は id 列を作らず第 3 引数に書く", () => {
  const { output, error } = generate({ table: "tag_rows", primaryKey: { columns: ["name", "createdAt"], name: "tag_rows_pk" } });
  assert.equal(error, null);
  assert.match(output, /pgTable\("tag_rows", \{/);
  assert.doesNotMatch(output, /\n  id: /);
  assert.match(output, /primaryKey\(\{ name: "tag_rows_pk", columns: \[table\.name, table\.createdAt\] \}\)/);
  assert.match(output, /import \{[^}]*primaryKey[^}]*\} from "drizzle-orm\/pg-core"/);
});

test("fields[].column は列の名前・型・既定・NOT NULL・identity を書く", () => {
  const fields = [
    { name: "name", label: "名前", fieldType: "string", column: { name: "tag_name", notNull: true, default: "" } },
    { name: "hits", label: "数", fieldType: "number", column: { type: "bigint", identity: "always" } },
    { name: "score", label: "点", fieldType: "number", column: { type: "numeric(10, 2)" } },
    { name: "ip", label: "IP", fieldType: "string", column: { type: "inet" } },
    { name: "ids", label: "ID", fieldType: "string", column: { type: "uuid[]" } },
    { name: "seenAt", label: "見た", fieldType: "timestamp", column: { default: { sql: "now()" }, notNull: true } },
    { name: "meta", label: "付帯", fieldType: "string", column: { type: "jsonb", default: {} } },
  ];
  const { output, error } = generate({ fields });
  assert.equal(error, null);
  assert.match(output, /\n  name: text\("tag_name"\)\.notNull\(\)\.default\(""\),/);
  assert.match(output, /\n  hits: bigint\("hits", \{ mode: "number" \}\)\.generatedAlwaysAsIdentity\(\),/);
  assert.match(output, /\n  score: numeric\("score", \{ precision: 10, scale: 2 \}\),/);
  assert.match(output, /\n  ip: inet\("ip"\),/);
  assert.match(output, /\n  ids: uuid\("ids"\)\.array\(\),/);
  assert.match(output, /\n  seenAt: timestamp\("seen_at"[^)]*\)\.notNull\(\)\.default\(sql`now\(\)`\),/);
  assert.match(output, /\n  meta: jsonb\("meta"\)\.default\(\{\}\),/);
  assert.match(output, /import \{ sql \} from "drizzle-orm";/);
});

test("enums は pgEnum の定義、valuesFrom は名指した export を import して渡す。column.enum がそれを使う", () => {
  const fields = [
    { name: "kind", label: "種類", fieldType: "string", column: { enum: "tag_kind", notNull: true } },
    { name: "state", label: "状態", fieldType: "string", column: { enum: "tag_state" } },
  ];
  const enums = [
    { name: "tag_kind", values: ["a", "b"] },
    { name: "tag_state", valuesFrom: { file: "src/domains/sampleTag/constants/state.ts", export: "TAG_STATES" } },
  ];
  const { output, error } = generate({ fields, enums });
  assert.equal(error, null);
  assert.match(output, /export const tagKindEnum = pgEnum\("tag_kind", \["a", "b"\]\);/);
  assert.match(output, /import \{ TAG_STATES \} from "@\/domains\/sampleTag\/constants\/state";/);
  assert.match(output, /export const tagStateEnum = pgEnum\("tag_state", TAG_STATES\);/);
  assert.match(output, /\n  kind: tagKindEnum\("kind"\)\.notNull\(\),/);
  assert.match(output, /\n  state: tagStateEnum\("state"\),/);
});

test("foreignKeys(自己参照・別の表)と checks を第 3 引数に書く", () => {
  const files = { "src/domains/core/user/entities/drizzle.ts": 'export const UserTable = pgTable("users", {\n  id: uuid("id"),\n});\n' };
  const fields = [
    { name: "parentId", label: "親", fieldType: "string", column: { type: "uuid" } },
    { name: "ownerId", label: "持ち主", fieldType: "string", column: { type: "uuid" } },
  ];
  const { output, error } = generate(
    {
      fields,
      foreignKeys: [
        { columns: ["parentId"], references: { table: "sample_tags", columns: ["id"] }, onDelete: "SET_NULL", name: "sample_tags_parent_fk" },
        { columns: ["ownerId"], references: { table: "users", columns: ["id"] }, onDelete: "CASCADE" },
      ],
      checks: [{ name: "sample_tags_name_check", sql: "char_length(name) > 0" }],
    },
    { files },
  );
  assert.equal(error, null);
  assert.match(output, /foreignKey\(\{ name: "sample_tags_parent_fk", columns: \[table\.parentId\], foreignColumns: \[table\.id\] \}\)\.onDelete\("set null"\)/);
  assert.match(output, /import \{ UserTable \} from "@\/domains\/core\/user\/entities\/drizzle";/);
  assert.match(output, /foreignKey\(\{ columns: \[table\.ownerId\], foreignColumns: \[UserTable\.id\] \}\)\.onDelete\("cascade"\)/);
  assert.match(output, /check\("sample_tags_name_check", sql`char_length\(name\) > 0`\)/);
});

test("indexes の unique・desc・expression", () => {
  const { output, error } = generate({
    indexes: [
      { fields: ["name", "createdAt"], desc: ["createdAt"] },
      { fields: ["name"], unique: true, where: "deleted_at IS NULL", name: "sample_tags_name_uq" },
      { expression: "lower(btrim(name))", name: "sample_tags_name_lower_idx" },
      { expressions: ["(meta->>'a')", "(meta->>'b')", "lower(name)"], unique: true, where: "deleted_at IS NULL", name: "sample_tags_meta_parts_uq" },
      { expressions: ["to_tsvector('simple', name)", "to_tsvector('simple', code)"], using: "gin", name: "sample_tags_search_idx" },
    ],
  });
  assert.equal(error, null);
  assert.match(output, /index\("sample_tags_name_created_at_idx"\)\.on\(table\.name, table\.createdAt\.desc\(\)\)/);
  assert.match(output, /uniqueIndex\("sample_tags_name_uq"\)\.on\(table\.name\)\.where\(sql`deleted_at IS NULL`\)/);
  assert.match(output, /index\("sample_tags_name_lower_idx"\)\.on\(sql`lower\(btrim\(name\)\)`\)/);
  assert.match(output, /uniqueIndex\("sample_tags_meta_parts_uq"\)\.on\(sql`\(meta->>'a'\)`, sql`\(meta->>'b'\)`, sql`lower\(name\)`\)\.where\(sql`deleted_at IS NULL`\)/);
  assert.match(output, /index\("sample_tags_search_idx"\)\.using\("gin", sql`to_tsvector\('simple', name\)`, sql`to_tsvector\('simple', code\)`\)/);
});

test("表だけの列 columns・列のユニーク column.unique・関連の 1 対 1 の unique", () => {
  const relations = (baseConfig.relations ?? []).length > 0 ? baseConfig.relations : [];
  const { output, error } = generate({
    fields: [{ name: "name", label: "名前", fieldType: "string", required: true, column: { unique: true } }],
    columns: [
      { name: "rank", column: { type: "smallint", notNull: true, default: 0 } },
      { name: "code", column: { type: "text", unique: true } },
    ],
    useSoftDelete: true,
    relations,
  });
  assert.equal(error, null);
  assert.match(output, /\n  name: text\("name"\)\.notNull\(\)\.unique\(\),/, "ソフトデリートでも列の制約のまま");
  assert.match(output, /\n  rank: smallint\("rank"\)\.notNull\(\)\.default\(0\),/);
  assert.match(output, /\n  code: text\("code"\)\.unique\(\),/);
  assert.doesNotMatch(output, /_unique_active/);

  const files = { "src/domains/core/user/entities/drizzle.ts": 'export const UserTable = pgTable("users", {\n  id: uuid("id"),\n});\n' };
  const oneToOne = generate({ relations: [{ domain: "user", label: "ユーザー", fieldName: "user_id", fieldType: "uuid", relationType: "belongsTo", required: true, unique: true }] }, { files });
  assert.equal(oneToOne.error, null);
  assert.match(oneToOne.output, /\n  user_id: uuid\("user_id"\)\.notNull\(\)\.unique\(\)/);

  const missing = generate({ columns: [{ name: "x", column: { notNull: true } }] });
  assert.match(missing.error.message, /column\.type か column\.enum を書く/);
});

test("関連の foreignKey:false は列だけ書き、型の表に無い fieldType は分かる文で止める", () => {
  const files = { "src/domains/core/user/entities/drizzle.ts": 'export const UserTable = pgTable("users", {\n  id: uuid("id"),\n});\n' };
  const noFk = generate({ relations: [{ domain: "user", label: "ユーザー", fieldName: "user_id", fieldType: "uuid", relationType: "belongsTo", foreignKey: false }] }, { files });
  assert.equal(noFk.error, null);
  assert.match(noFk.output, /\n  user_id: uuid\("user_id"\),/);
  assert.doesNotMatch(noFk.output, /references|UserTable/);
  const unknown = generate({ fields: [{ name: "ids", label: "ID", fieldType: "uuid[]" }] });
  assert.match(unknown.error.message, /fieldType "uuid\[\]" は型の表.*に無い/);
});

test("書けない形はエラーにする", () => {
  const cases = [
    [{ fields: [{ name: "x", fieldType: "string", column: { type: "money" } }] }, /column\.type "money" は書けない型/],
    [{ fields: [{ name: "x", fieldType: "string", column: { enum: "none" } }] }, /column\.enum "none" が enums にありません/],
    [{ fields: [{ name: "x", fieldType: "string", defaultValue: "a", column: { default: "b" } }] }, /defaultValue と column\.default の両方/],
    [{ enums: [{ name: "e" }] }, /values\(空でない配列\)か valuesFrom/],
    [{ indexes: [{ expression: "lower(name)" }] }, /式の索引には name が要ります/],
    [{ indexes: [{ expressions: ["a", "b"] }] }, /式の索引には name が要ります/],
    [{ indexes: [{ expressions: ["a", "b"], fields: ["name"], name: "x" }] }, /expressions と fields の両方を持てません/],
    [{ indexes: [{ expressions: ["a", "b"], expression: "c", name: "x" }] }, /expression と expressions の両方を持てません/],
    [{ indexes: [{ expressions: [], name: "x" }] }, /expressions は 2 つ以上の SQL の式の並び/],
    [{ indexes: [{ expressions: ["a"], name: "x" }] }, /expressions は 2 つ以上の SQL の式の並び/],
    [{ indexes: [{ expressions: ["a", 1], name: "x" }] }, /expressions は空でない SQL の式/],
    [{ indexes: [{ fields: ["name"], desc: ["other"] }] }, /desc "other" が fields にありません/],
    [{ foreignKeys: [{ columns: ["name"], references: { table: "nowhere", columns: ["id"] } }] }, /references\.table "nowhere" の表がどのドメインにもありません/],
  ];
  for (const [extra, pattern] of cases) {
    const { output, error } = generate(extra);
    assert.equal(output, null);
    assert.match(error.message, pattern);
  }
});

test("Firestore の config に表の形の鍵があれば生成器が止める", () => {
  const root = makeProject({ configs: { sampleTag: { ...baseConfig, dbEngine: "Firestore", table: "x" } }, cleanup });
  const { workspace, ctx } = contextFor(root, "sampleTag");
  assert.throws(() => renderEntities(ctx, workspace), /Firestore です。表の形の鍵/);
});
