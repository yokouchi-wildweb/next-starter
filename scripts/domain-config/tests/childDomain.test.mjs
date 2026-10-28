// 主の集まりの項目（mediaCollection）から従属ドメインの domain.json を組む純関数と、その write-once の書き出しの回帰テスト。
// 実行: pnpm test:dc-child-domain
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { vocabularyWarnings } from "../checks/vocabulary.mjs";
import { reportDryRun } from "../pipeline/dryRun.mjs";
import { planDomain } from "../pipeline/plan.mjs";
import { buildChildDomainConfig } from "../render/collections/childDomainConfig.mjs";
import formatDomainConfig from "../spec/format.mjs";
import { applyAndCapture, contextFor, makeProject, removeAll } from "./helpers.mjs";

const cleanup = [];
after(() => removeAll(cleanup));

const ADMIN = { roleCategories: ["admin"] };
const field = (overrides = {}) => ({
  name: "images",
  label: "画像",
  fieldType: "mediaCollection",
  formInput: "mediaUploaderMulti",
  required: true,
  reorderable: true,
  collection: { domain: "sample_image", maxItems: 10, duplicate: true },
  ...overrides,
});
const parent = (overrides = {}) => ({
  domainConfigVersion: "1.3",
  singular: "sample",
  plural: "samples",
  label: "サンプル",
  dbEngine: "Neon",
  idType: "uuid",
  relations: [],
  useCreatedAt: true,
  useUpdatedAt: true,
  fields: [{ name: "name", label: "名前", fieldType: "string", formInput: "textInput", required: true }, field()],
  apiAccess: { read: "public", write: ADMIN },
  generateFiles: { entities: true, registry: true },
  ...overrides,
});
const storageOf = (parentConfig) => buildChildDomainConfig(parentConfig, field()).config.fields[0].storage;

test("従属の形: belongsTo 主（必須・CASCADE）、メディア 1 項目 + 並び列、閉じた API、生成ファイルの組。語彙の検査を警告なく通る", () => {
  const { config, uncopied } = buildChildDomainConfig(parent(), field());
  assert.deepEqual(uncopied, []);
  assert.equal(config.singular, "sample_image");
  assert.equal(config.plural, "sample_images");
  assert.equal(config.label, "画像");
  assert.equal(config.dbEngine, "Neon");
  assert.deepEqual(config.relations, [
    { domain: "sample", label: "サンプル", fieldName: "sample_id", fieldType: "uuid", relationType: "belongsTo", required: true, onDelete: "CASCADE" },
  ]);
  assert.equal(config.useSoftDelete, false);
  assert.equal(config.sortOrderField, "sort_order");
  assert.deepEqual(config.systemColumns, ["sort_order"]);
  assert.deepEqual(config.fields.map((f) => [f.name, f.fieldType, f.formInput]), [["file", "mediaUploader", "mediaUploader"], ["sort_order", "string", "hidden"]]);
  assert.deepEqual(
    { ...config.fields[0], storage: undefined },
    { name: "file", label: "画像", fieldType: "mediaUploader", formInput: "mediaUploader", required: true, slug: "images", mediaTypePreset: "images", accept: "image/*", validationRule: { maxSizeBytes: 10485760 }, storage: undefined },
  );
  assert.equal(config.addToAdminDataMenu, false);
  assert.deepEqual(config.apiAccess, { read: "none", write: "none" });
  assert.deepEqual(
    Object.entries(config.generateFiles).filter(([, on]) => on).map(([key]) => key).sort(),
    ["entities", "fieldConstants", "presenters", "registry", "serverServices"],
  );
  assert.deepEqual(vocabularyWarnings(config), []);
});

test("名前と plural: 既定の名前なら plural を書き、変えていれば書かない。s で終わらない項目は plural なし", () => {
  assert.equal(buildChildDomainConfig(parent(), field({ collection: { domain: "photo_item" } })).config.plural, undefined);
  const gallery = buildChildDomainConfig(parent(), field({ name: "gallery", collection: { domain: "sample_gallery" } })).config;
  assert.equal(gallery.singular, "sample_gallery");
  assert.equal("plural" in gallery, false);
  assert.equal(buildChildDomainConfig(parent(), field({ name: "gallery", collection: { domain: "sample_gallery" } })).config.fields[0].slug, "gallery");
});

test("idType と外部キーの型は主に従う（DB 採番は number）", () => {
  for (const [idType, fieldType] of [["uuid", "uuid"], ["string", "string"], ["number", "number"], ["db", "number"]]) {
    const { config } = buildChildDomainConfig(parent({ idType }), field());
    assert.equal(config.idType, idType);
    assert.equal(config.relations[0].fieldType, fieldType);
  }
});

test("権限の写し: 公開読み取りの主 → public、アップロードは create と update の和", () => {
  assert.deepEqual(storageOf(parent()), { visibility: "public", upload: ADMIN, read: "public" });
  assert.deepEqual(
    storageOf(parent({ apiAccess: { read: "authenticated", write: "authenticated" } })),
    { visibility: "private", upload: "authenticated", read: "authenticated" },
  );
  assert.deepEqual(
    storageOf(parent({ apiAccess: { read: { roles: ["editor"] }, operations: { create: { roles: ["editor"] }, update: { roleCategories: ["admin"] } } } })),
    { visibility: "private", upload: { roles: ["editor"], roleCategories: ["admin"] }, read: { roles: ["editor"] } },
  );
  // 宣言なし = fail-closed の既定（管理者のみ）がそのまま本当の規則
  assert.deepEqual(buildChildDomainConfig(parent({ apiAccess: undefined }), field()).uncopied, []);
  assert.deepEqual(storageOf(parent({ apiAccess: undefined })), { visibility: "private", upload: ADMIN, read: ADMIN });
});

test("権限の写し: 閉じた主（none / INTERNAL_ONLY）・custom などの写せない値・手書きの domainEntry → 管理者のみ + 直す対象", () => {
  const closed = buildChildDomainConfig(parent({ apiAccess: { read: "none", write: "none" } }), field());
  assert.deepEqual(closed.uncopied, ["upload", "read"]);
  assert.deepEqual(closed.config.fields[0].storage, { visibility: "private", upload: ADMIN, read: ADMIN });

  const customGet = buildChildDomainConfig(parent({ apiAccess: { read: "public", write: ADMIN, operations: { get: "custom" } } }), field());
  assert.deepEqual(customGet.uncopied, ["read"]);
  assert.deepEqual(customGet.config.fields[0].storage, { visibility: "private", upload: ADMIN, read: ADMIN });

  const closedCreate = buildChildDomainConfig(parent({ apiAccess: { read: "public", write: ADMIN, operations: { create: "none" } } }), field());
  assert.deepEqual(closedCreate.uncopied, ["upload"]);
  assert.equal(closedCreate.config.fields[0].storage.read, "public");

  const handWritten = buildChildDomainConfig(parent({ generateFiles: { entities: true, registry: false } }), field());
  assert.deepEqual(handWritten.uncopied, ["upload", "read"]);
});

// ---- 書き出し（write-once） ----

const childPath = (root) => path.join(root, "src", "features", "sampleImage", "domain.json");
const outputsFor = (root, gen = { entities: false }) => {
  const { workspace, ctx } = contextFor(root, "sample");
  return { workspace, outputs: planDomain(ctx, workspace, gen) };
};

test("書き出し: 従属の domain.json が無ければ formatDomainConfig の形で書き、パスを出す（generateFiles に関わらず）", () => {
  const root = makeProject({ configs: { sample: parent() }, cleanup });
  const { stdout } = applyAndCapture(outputsFor(root).outputs);
  assert.equal(fs.readFileSync(childPath(root), "utf8"), formatDomainConfig(buildChildDomainConfig(parent(), field()).config));
  assert.match(stdout, /集まり images の従属の domain\.json を書き出しました: .*sampleImage\/domain\.json/);
});

test("書き出し: 既にあれば書かない（中身はそのまま、権限の案内も出さない）", () => {
  const closedParent = parent({ apiAccess: { read: "none", write: "none" } });
  const root = makeProject({ configs: { sample: closedParent, sampleImage: { singular: "sample_image", handWritten: true } }, cleanup });
  const before = fs.readFileSync(childPath(root), "utf8");
  const { stdout } = applyAndCapture(outputsFor(root).outputs);
  assert.equal(fs.readFileSync(childPath(root), "utf8"), before);
  assert.match(stdout, /従属の domain\.json は既にあるため書きません/);
  assert.doesNotMatch(stdout, /管理者のみにしました/);
});

test("書き出し: 写せない権限は管理者のみにして直す場所を出す", () => {
  const root = makeProject({ configs: { sample: parent({ apiAccess: { read: "none", write: "none" } }) }, cleanup });
  const { stdout } = applyAndCapture(outputsFor(root).outputs);
  assert.match(stdout, /従属の storage\.upload \/ storage\.read を管理者のみにしました。直す場所: .*sampleImage\/domain\.json の fields "file"/);
});

test("dry-run: 無ければ「作成」、あれば「保持」と出し、何も書かない", () => {
  const root = makeProject({ configs: { sample: parent() }, cleanup });
  const lines = [];
  const { workspace, outputs } = outputsFor(root);
  const counts = reportDryRun(outputs, workspace, { log: (m) => lines.push(m) });
  assert.equal(counts["作成"], 1);
  assert.match(lines.join("\n"), /作成.*sampleImage\/domain\.json/);
  assert.equal(fs.existsSync(childPath(root)), false);

  applyAndCapture(outputs);
  const again = outputsFor(root);
  const keptLines = [];
  assert.equal(reportDryRun(again.outputs, again.workspace, { log: (m) => keptLines.push(m) })["保持"], 1);
  assert.match(keptLines.join("\n"), /保持.*sampleImage\/domain\.json/);
});

test("集まりの項目が無い主は何も足さない", () => {
  const root = makeProject({ configs: { sample: parent({ fields: [{ name: "name", label: "名前", fieldType: "string", formInput: "textInput" }] }) }, cleanup });
  assert.deepEqual(outputsFor(root).outputs, []);
});
