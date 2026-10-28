// 主の集まりの項目（mediaCollection）の主の生成物の回帰テスト: 列を出さない・スキーマ・モデル・Fields の用途とファイルの条件。
// parity の fixture showcase（従属 showcase_photo はこの実行で書き出す）を一時の workspace で組ごと生成して見る。
// 実行: pnpm test:dc-parent-outputs
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createWorkspace } from "../domain/workspace.mjs";
import { generateWithPairs, loadDomainForGenerate } from "../pipeline/generate.mjs";
import { collectionChildrenOf, resolvePairs } from "../pipeline/pairs.mjs";
import { collectionFieldPatches } from "../render/components/fields.mjs";
import { makeProject, removeAll, repoRoot } from "./helpers.mjs";

const cleanup = [];
after(() => removeAll(cleanup));

const SILENT = { log() {}, warn() {} };
const showcase = JSON.parse(fs.readFileSync(path.join(repoRoot, "scripts/domain-config/tests/fixtures/parity/synthetic/showcase/domain.json"), "utf8"));

function generateShowcase(config = showcase) {
  const root = makeProject({ templates: ["components"], configs: { showcase: config }, cleanup });
  const workspace = createWorkspace(root);
  const ctx = loadDomainForGenerate(workspace, "showcase", SILENT);
  generateWithPairs(ctx, workspace, { entities: true, components: true }, { only: ["entities", "components"], io: SILENT });
  const read = (rel) => fs.readFileSync(path.join(root, "src", "features", "showcase", rel), "utf8");
  return { root, workspace, read };
}

test("drizzle: 集まりの項目は列を出さない（型名の列関数も import しない）", () => {
  const drizzle = generateShowcase().read("entities/drizzle.ts");
  assert.doesNotMatch(drizzle, /photos/);
  assert.doesNotMatch(drizzle, /mediaCollection/);
  assert.match(drizzle, /brochure: text\("brochure"\)/);
});

test("スキーマ: 値は複数枚の行と同じ z.array(storageMediaValueSchema)、required → min(1)、collection.maxItems → max", () => {
  const schema = generateShowcase().read("entities/schema.ts");
  assert.match(
    schema,
    /photos: z\.array\(storageMediaValueSchema\)\.min\(1, \{ message: "写真は1件以上必要です。" \}\)\.max\(8, \{ message: "写真は8件以下にしてください。" \}\)\.default\(\[\]\),/,
  );
  assert.match(schema, /import \{ storageMediaValueSchema \} from "@\/lib\/storage\/schema";/);
});

test("スキーマ: 必須でなく最大件数も無い集まりは min / max を付けない", () => {
  const fields = showcase.fields.map((f) => (f.name === "photos" ? { ...f, required: false, collection: { domain: "showcase_photo" } } : f));
  const schema = generateShowcase({ ...showcase, fields }).read("entities/schema.ts");
  assert.match(schema, /photos: z\.array\(storageMediaValueSchema\)\.default\(\[\]\),/);
});

test("モデル: string[]（null にならない）", () => {
  assert.match(generateShowcase().read("entities/model.ts"), /^ {2}photos: string\[\];$/m);
});

test("Fields: 従属の file の用途・accept・上限サイズと、集まりの件数を載せる（この実行で書き出す従属の中身から）", () => {
  const fieldsTsx = generateShowcase().read("components/common/ShowcaseFields.tsx");
  assert.match(fieldsTsx, /const COLLECTION_FIELD_PATCHES: Record<string, Partial<FieldConfig>> = \{\n {2}photos: \{"purpose":"showcasePhoto\.file","accept":"image\/\*","validationRule":\{"maxSizeBytes":10485760,"maxItems":8,"minItems":1\}\},\n\};/);
  assert.match(fieldsTsx, /brochure: "showcase\.brochure",/);
  assert.match(fieldsTsx, /return field\.name in COLLECTION_FIELD_PATCHES \? \{ \.\.\.withPurpose, \.\.\.COLLECTION_FIELD_PATCHES\[field\.name\] \} : withPurpose;/);
});

test("Fields: 既にある従属の domain.json の file の条件を読み、用途は collection.domain に従う", () => {
  const fields = showcase.fields.map((f) => (f.name === "photos" ? { ...f, required: false, collection: { domain: "gallery_shot" } } : f));
  const owner = { ...showcase, fields };
  const { workspace } = generateShowcase(owner);
  const pairs = resolvePairs(workspace);
  const [{ patch }] = collectionFieldPatches(owner, collectionChildrenOf(workspace, pairs, "showcase"));
  assert.deepEqual(patch, { purpose: "galleryShot.file", accept: "image/*", validationRule: { maxSizeBytes: 10485760 } });

  const child = JSON.parse(fs.readFileSync(workspace.configPath("galleryShot"), "utf8"));
  child.fields[0] = { ...child.fields[0], accept: "image/png", validationRule: { maxSizeBytes: 2048 } };
  fs.writeFileSync(workspace.configPath("galleryShot"), JSON.stringify(child));
  const [{ patch: fromDisk }] = collectionFieldPatches(owner, collectionChildrenOf(workspace, resolvePairs(workspace), "showcase"));
  assert.deepEqual(fromDisk, { purpose: "galleryShot.file", accept: "image/png", validationRule: { maxSizeBytes: 2048 } });
});

test("Fields: 従属が分からなくても用途名は collection.domain から出す（直接 render を呼ぶ経路）", () => {
  const [{ patch }] = collectionFieldPatches(showcase);
  assert.deepEqual(patch, { purpose: "showcasePhoto.file", validationRule: { maxItems: 8, minItems: 1 } });
});
