// .notices/20261127-152752-junction-registration.junctions.mjs の検査(読み書きは一時の木、宣言から表を組む生成器と参照先の表はこのリポジトリの物、
// 今の中間の表は記憶の中で作る)。実行: pnpm test .notices/20261127-152752-junction-registration.junctions.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { index, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";

import { makeTempDir } from "../scripts/structure/domain-tables/tables.mjs";
import { UserTable } from "../src/domains/core/user/entities/user/drizzle.ts";
import { SampleTable } from "../src/domains/sample/entities/sample/drizzle.ts";
import { SampleTagTable } from "../src/domains/sampleTag/entities/sampleTag/drizzle.ts";
import { planJunctions, writePlan } from "./20261127-152752-junction-registration.junctions.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempDir = makeTempDir();
const trees = [];
after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  for (const tree of trees) fs.rmSync(tree, { recursive: true, force: true });
});

/** 一時の木: 道 → 中身(object は JSON) */
function makeTree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "junctions-"));
  trees.push(root);
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n`);
  }
  return root;
}
const read = (root, file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const many = (domain, includeRelationTable, extra = {}) => ({ domain, label: domain, fieldName: `${domain}_ids`, fieldType: "uuid", relationType: "belongsToMany", required: false, ...(includeRelationTable === undefined ? {} : { includeRelationTable }), ...extra });
const entity = (singular, plural, relations, extra = {}) => ({ singular, plural, label: singular, dbEngine: "Neon", idType: "uuid", relations, fields: [], ...extra });

/** 今の生成器が書いていた sample_to_sample_tag と同じ表 */
const sampleToSampleTag = pgTable(
  "sample_to_sample_tag",
  {
    sampleId: uuid("sample_id").notNull().references(() => SampleTable.id, { onDelete: "cascade" }),
    sampleTagId: uuid("sample_tag_id").notNull().references(() => SampleTagTable.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.sampleId, table.sampleTagId] })],
);

test("生成する持つ側: 今の表から結びの登録を今の名前で起こし(照らしの差 0)、関係を through に、書いた後の 2 度目は何もしない", async () => {
  const root = makeTree({
    "src/domains/sample/entities/sample/entity.json": entity("sample", "samples", [many("sample_tag", true, { formInput: "asyncMultiSelect" })]),
    "src/domains/sampleTag/entities/sampleTag/entity.json": entity("sample_tag", "sample_tags", [many("sample", false)]),
  });
  const loadTable = async (name) => (name === "sample_to_sample_tag" ? { table: sampleToSampleTag, exportName: "SampleToSampleTagTable", file: "src/domains/sample/entities/sample/drizzle.ts" } : null);
  const plan = await planJunctions({ root, repoRoot, loadTable, tempDir });
  assert.deepEqual(plan.stops, []);
  const junction = JSON.parse(plan.writes["src/domains/sample/entities/sampleToSampleTag/entity.json"]);
  assert.equal(junction.registered, false);
  assert.equal(junction.generate, undefined, "持つ側の generate(true)のまま");
  assert.deepEqual(junction.primaryKey, { columns: ["sampleId", "sampleTagId"], name: "sample_to_sample_tag_sample_id_sample_tag_id_pk" });
  assert.deepEqual(junction.columns.map((column) => column.name), ["sampleId", "sampleTagId"]);
  assert.deepEqual(junction.foreignKeys.map((fk) => [fk.name, fk.onDelete]), [
    ["sample_to_sample_tag_sample_id_samples_id_fk", "CASCADE"],
    ["sample_to_sample_tag_sample_tag_id_sample_tags_id_fk", "CASCADE"],
  ]);
  assert.equal(Object.keys(plan.writes).some((file) => file.endsWith("drizzle.ts")), false, "生成する側の表の文は動かさない(pnpm forge が書く)");
  writePlan(root, plan);
  const owner = read(root, "src/domains/sample/entities/sample/entity.json").relations[0];
  assert.deepEqual(Object.keys(owner), ["domain", "label", "fieldName", "fieldType", "relationType", "required", "through", "formInput"]);
  assert.equal(owner.through, "sampleToSampleTag");
  assert.equal("includeRelationTable" in read(root, "src/domains/sampleTag/entities/sampleTag/entity.json").relations[0], false);
  const again = await planJunctions({ root, repoRoot, loadTable, tempDir });
  assert.deepEqual([again.lines, again.stops, again.writes], [[], [], {}]);
});

test("手で持つ側: 表の文を持つ側の表のファイルから結びのフォルダへ import ごと移し、使われなくなった import を外す", async () => {
  const ownerFile = "src/domains/core/user/entities/user/drizzle.ts";
  const ownerText = `// ${ownerFile}

import { pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { SampleTagTable } from "@/domains/sampleTag/entities/drizzle";

export const UserTable = pgTable("users", { id: uuid("id").primaryKey(), name: text("name") });

// 利用者とタグ
export const UserToSampleTagTable = pgTable(
  "user_to_sample_tag",
  {
    userId: uuid("user_id").notNull().references(() => UserTable.id, { onDelete: "cascade" }),
    sampleTagId: uuid("sample_tag_id").notNull().references(() => SampleTagTable.id, { onDelete: "restrict" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.sampleTagId] })],
);
`;
  const running = pgTable(
    "user_to_sample_tag",
    {
      userId: uuid("user_id").notNull().references(() => UserTable.id, { onDelete: "cascade" }),
      sampleTagId: uuid("sample_tag_id").notNull().references(() => SampleTagTable.id, { onDelete: "restrict" }),
    },
    (table) => [primaryKey({ columns: [table.userId, table.sampleTagId] }), index("user_to_sample_tag_tag_idx").on(table.sampleTagId)],
  );
  const root = makeTree({
    "src/domains/core/user/entities/user/entity.json": entity("user", "users", [many("sample_tag", undefined)], { generate: false }),
    [ownerFile]: ownerText,
    "src/domains/sampleTag/entities/sampleTag/entity.json": entity("sample_tag", "sample_tags", []),
  });
  const plan = await planJunctions({ root, repoRoot, loadTable: async () => ({ table: running, exportName: "UserToSampleTagTable", file: ownerFile }), tempDir });
  assert.deepEqual(plan.stops, []);
  const junction = JSON.parse(plan.writes["src/domains/core/user/entities/userToSampleTag/entity.json"]);
  assert.equal(junction.generate, false);
  assert.deepEqual(junction.indexes, [{ name: "user_to_sample_tag_tag_idx", fields: ["sampleTagId"] }]);
  assert.equal(junction.foreignKeys[1].onDelete, "RESTRICT");
  const moved = plan.writes["src/domains/core/user/entities/userToSampleTag/drizzle.ts"];
  assert.match(moved, /^\/\/ src\/domains\/core\/user\/entities\/userToSampleTag\/drizzle\.ts\n/);
  assert.match(moved, /import \{ SampleTagTable \} from "@\/domains\/sampleTag\/entities\/drizzle";/);
  assert.match(moved, /import \{ UserTable \} from "\.\.\/user\/drizzle";/);
  assert.match(moved, /import \{ pgTable, primaryKey, uuid \} from "drizzle-orm\/pg-core";/);
  assert.match(moved, /\/\/ 利用者とタグ\nexport const UserToSampleTagTable = pgTable\(/);
  const rest = plan.writes[ownerFile];
  assert.doesNotMatch(rest, /UserToSampleTagTable|SampleTagTable|import \{[^}]*primaryKey/);
  assert.match(rest, /import \{ pgTable, text, uuid \} from "drizzle-orm\/pg-core";/);
  assert.match(rest, /export const UserTable = pgTable/);
  assert.equal(JSON.parse(plan.writes["src/domains/core/user/entities/user/entity.json"]).relations[0].through, "userToSampleTag");
});

test("両側とも includeRelationTable:false: 今ある結びの登録(user ↔ userTag の形)のドメインの側を持つ側にし、結びの登録はそのまま", async () => {
  const junction = read(repoRoot, "src/domains/core/user/entities/userToUserTag/entity.json");
  const root = makeTree({
    "src/domains/core/user/entities/user/entity.json": entity("user", "users", [many("user_tag", false)], { generate: false }),
    "src/domains/core/user/entities/userToUserTag/entity.json": junction,
    "src/domains/core/userTag/entities/userTag/entity.json": entity("user_tag", "user_tags", [many("user", false)], { generate: false }),
  });
  const plan = await planJunctions({ root, repoRoot, loadTable: async () => assert.fail("今ある結びの登録は表を読まない"), tempDir });
  assert.deepEqual(plan.stops, []);
  assert.deepEqual(Object.keys(plan.writes).sort(), ["src/domains/core/user/entities/user/entity.json", "src/domains/core/userTag/entities/userTag/entity.json"]);
  assert.equal(JSON.parse(plan.writes["src/domains/core/user/entities/user/entity.json"]).relations[0].through, "userToUserTag");
  assert.deepEqual(JSON.parse(plan.writes["src/domains/core/userTag/entities/userTag/entity.json"]).relations[0], { domain: "user", label: "user", fieldName: "user_ids", fieldType: "uuid", relationType: "belongsToMany", required: false });
});

test("止める(何も書かない): どちらも持たず結びも無い、両側とも持つ側、今の表が無い", async () => {
  const tree = (ownerFlag, targetFlag) =>
    makeTree({
      "src/domains/sample/entities/sample/entity.json": entity("sample", "samples", [many("sample_tag", ownerFlag)]),
      "src/domains/sampleTag/entities/sampleTag/entity.json": entity("sample_tag", "sample_tags", [many("sample", targetFlag)]),
    });
  const none = async () => null;
  const neither = await planJunctions({ root: tree(false, false), repoRoot, loadTable: none, tempDir });
  assert.match(neither.stops.join("\n"), /どちらの関係も includeRelationTable:false で、両側の表を指す結びの登録も無い/);
  const both = await planJunctions({ root: tree(true, undefined), repoRoot, loadTable: none, tempDir });
  assert.match(both.stops.join("\n"), /両側とも中間の表を持つ側になっている/);
  const missing = await planJunctions({ root: tree(true, false), repoRoot, loadTable: none, tempDir });
  assert.match(missing.stops.join("\n"), /今の中間の表 sample_to_sample_tag が見つからない/);
});
