// 多対多の結びの登録(D354)の検査と生成: through が名指す同じドメインの登録が両側への結び 2 本・合成の主キー・registered:false を持つこと、
// 1 つの結びを名指す関係は 1 つだけ、反対側は through を書かない参照、生成器は結びを自分の登録のフォルダに書く(主の表のファイルには書かない)。
// 実行: pnpm test scripts/structure/domain/tests/junctions.test.mjs
import { after, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { junctionIssues } from "../checks/junctions.mjs";
import { relationIssues } from "../checks/relations.mjs";
import { createWorkspace } from "../domain/workspace.mjs";
import { planGenerateAll } from "../pipeline/generateAll.mjs";
import { resolvePairs } from "../pipeline/pairs.mjs";
import { ALL_GENERATE_OPTIONS } from "../spec/categories.mjs";
import { makeProject, removeAll } from "./helpers.mjs";

const cleanup = [];
after(() => removeAll(cleanup));
const SILENT = { log() {}, warn() {} };

const base = (singular, extra = {}) => ({ label: singular, singular, plural: `${singular}s`, dbEngine: "Neon", idType: "uuid", useCreatedAt: true, useUpdatedAt: true, fields: [{ name: "name", label: "名前", fieldType: "string", formInput: "textInput" }], ...extra });
const tags = { domain: "sample_tag", label: "タグ", fieldName: "sample_tag_ids", fieldType: "uuid", relationType: "belongsToMany", formInput: "asyncMultiSelect", through: "sampleToSampleTag" };
/** 今の生成物 sample_to_sample_tag と同じ表の結びの登録 */
const junction = (extra = {}) => ({
  label: "サンプルとタグ",
  singular: "sample_to_sample_tag",
  plural: "sample_to_sample_tag",
  dbEngine: "Neon",
  idType: "uuid",
  registered: false,
  useCreatedAt: false,
  useUpdatedAt: false,
  fields: [],
  relations: [
    { domain: "sample", label: "サンプル", fieldName: "sample_id", fieldType: "uuid", relationType: "belongsTo", required: true, onDelete: "CASCADE" },
    { domain: "sample_tag", label: "タグ", fieldName: "sample_tag_id", fieldType: "uuid", relationType: "belongsTo", required: true, onDelete: "CASCADE" },
  ],
  primaryKey: { columns: ["sample_id", "sample_tag_id"] },
  ...extra,
});
const registrations = (entries) => new Map(Object.entries(entries).map(([name, [domain, config]]) => [name, { domain, config }]));
const messages = (map) => junctionIssues(map).errors.map((error) => error.message).join("\n");

test("正しい結び: 持つ側の through・同じドメインの結びの登録・反対側は through なしの参照、結びの登録名を返す", () => {
  const map = registrations({
    sample: ["sample", base("sample", { relations: [tags] })],
    sampleToSampleTag: ["sample", junction()],
    sampleTag: ["sampleTag", base("sample_tag", { relations: [{ domain: "sample", label: "サンプル", fieldName: "sample_ids", fieldType: "uuid", relationType: "belongsToMany" }] })],
  });
  const { errors, junctions } = junctionIssues(map);
  assert.deepEqual(errors, []);
  assert.deepEqual([...junctions], ["sampleToSampleTag"]);
});

test("止める: 無い・別のドメインの結び、2 つの関係が同じ結び、結びの形(2 本・required・合成の主キー・registered)、どちらも through の無い多対多", () => {
  const sampleTag = ["sampleTag", base("sample_tag")];
  assert.match(messages(registrations({ sample: ["sample", base("sample", { relations: [tags] })], sampleTag })), /through の "sampleToSampleTag" の登録がありません/);
  assert.match(messages(registrations({ sample: ["sample", base("sample", { relations: [tags] })], sampleToSampleTag: ["other", junction()], sampleTag })), /sample のドメイン sample でなく other にあります/);
  const twice = registrations({
    sample: ["sample", base("sample", { relations: [tags, { ...tags, fieldName: "other_ids" }] })],
    sampleToSampleTag: ["sample", junction()],
    sampleTag,
  });
  assert.match(messages(twice), /結びの登録を through で名指す関係が 2 つ以上/);
  const shape = (config) => messages(registrations({ sample: ["sample", base("sample", { relations: [tags] })], sampleToSampleTag: ["sample", config], sampleTag }));
  assert.match(shape(junction({ registered: undefined })), /registered: false にしてください/);
  assert.match(shape(junction({ relations: junction().relations.slice(0, 1) })), /sample と sampleTag を指す 2 本だけ/);
  assert.match(shape(junction({ relations: [junction().relations[0], { ...junction().relations[1], required: false }] })), /sample_tag_id の belongsTo は required: true/);
  assert.match(shape(junction({ primaryKey: undefined })), /主キーは 2 本の結びの列の合成/);
  const noOwner = registrations({ sample: ["sample", base("sample", { relations: [{ ...tags, through: undefined }] })], sampleTag });
  assert.match(messages(noOwner), /through\(結びの登録名\)が無く、相手 sampleTag も/);
});

test("手の表の形の結び(foreignKeys で名前つきの FK)も結びの 2 本として数える", () => {
  const hand = junction({
    relations: undefined,
    columns: [
      { name: "sample_id", column: { type: "uuid", notNull: true } },
      { name: "sample_tag_id", column: { type: "uuid", notNull: true } },
    ],
    foreignKeys: [
      { columns: ["sample_id"], references: { table: "samples", columns: ["id"] }, onDelete: "CASCADE", name: "s_to_st_sample_fk" },
      { columns: ["sample_tag_id"], references: { table: "sample_tags", columns: ["id"] }, onDelete: "RESTRICT" },
    ],
  });
  const map = registrations({ sample: ["sample", base("sample", { relations: [tags] })], sampleToSampleTag: ["sample", hand], sampleTag: ["sampleTag", base("sample_tag")] });
  assert.deepEqual(junctionIssues(map).errors, []);
});

test("includeRelationTable は廃止: 書き直し方を名指して止める、through は belongsToMany だけ", () => {
  const issues = relationIssues(base("sample", { relations: [{ ...tags, through: undefined, includeRelationTable: true }, { domain: "x", fieldName: "x_id", relationType: "belongsTo", through: "y" }] })).join("\n");
  assert.match(issues, /includeRelationTable は廃止しました\(D354\)。持つ側の関係に through: <結びの登録名>/);
  assert.match(issues, /through は belongsToMany にだけ書けます/);
});

test("生成: 結びは自分の登録のフォルダに今の sample_to_sample_tag と同じ表で書き、主の表のファイルには書かない。主の base は結びの登録の表と列を読む", () => {
  const root = makeProject({
    templates: ["."],
    configs: { sample: base("sample", { relations: [tags] }), sampleTag: base("sample_tag", { relations: [{ domain: "sample", label: "サンプル", fieldName: "sample_ids", fieldType: "uuid", relationType: "belongsToMany" }] }) },
    registrations: { "sample/sampleToSampleTag": junction() },
    cleanup,
  });
  const workspace = createWorkspace(root);
  const pairs = resolvePairs(workspace);
  assert.deepEqual(pairs.errors, []);
  assert.ok(pairs.junctions.has("sampleToSampleTag"));
  const { plans } = planGenerateAll(workspace, ["sample"], { ...ALL_GENERATE_OPTIONS, adminRoutes: false }, null, SILENT);
  const rel = (output) => path.relative(root, output.path).split(path.sep).join("/");
  const files = new Map(plans.flatMap((plan) => plan.outputs.filter((o) => o.kind === "file" || o.kind === "writeOnce").map((o) => [rel(o), o.content])));
  const junctionDrizzle = files.get("src/domains/sample/entities/sampleToSampleTag/drizzle.ts");
  assert.ok(junctionDrizzle, "結びの登録の drizzle.ts");
  assert.match(junctionDrizzle, /export const SampleToSampleTagTable = pgTable\(\s*"sample_to_sample_tag"/);
  assert.match(junctionDrizzle, /sample_id: uuid\("sample_id"\)\.notNull\(\)\s*\.references\(\(\) => SampleTable\.id, \{ onDelete: "cascade" \}\)/);
  assert.match(junctionDrizzle, /sample_tag_id: uuid\("sample_tag_id"\)\.notNull\(\)\s*\.references\(\(\) => SampleTagTable\.id, \{ onDelete: "cascade" \}\)/);
  assert.match(junctionDrizzle, /primaryKey\(\{ columns: \[table\.sample_id, table\.sample_tag_id\] \}\)/);
  assert.doesNotMatch(junctionDrizzle, /\bid: uuid\("id"\)|created_at/);
  // 結びは表のファイルだけ(サービス・画面・hooks を持たない)
  assert.equal([...files.keys()].some((file) => /sampleToSampleTag(Base|Service|Client)|useSampleToSampleTag/.test(file)), false);
  assert.doesNotMatch(files.get("src/domains/sample/entities/sample/drizzle.ts"), /SampleToSampleTag|sample_to_sample_tag/, "主の表のファイルに結びを書かない");
  const ownerBase = files.get("src/domains/sample/services/server/sampleBase.ts");
  assert.match(ownerBase, /throughTable: SampleToSampleTagTable,\s*sourceColumn: SampleToSampleTagTable\.sample_id,\s*targetColumn: SampleToSampleTagTable\.sample_tag_id,\s*sourceProperty: "sample_id",\s*targetProperty: "sample_tag_id",/);
});
