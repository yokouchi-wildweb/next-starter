// 主の集まりの項目（mediaCollection）の主の生成物の回帰テスト: 列を出さない・スキーマ・モデル・Fields の用途とファイルの条件、
// 配線（<登録名>Collections.ts・<登録名>Base の import と options・手書きの土台への案内）。
// parity の fixture showcase（従属 showcase_photo はこの実行で主のドメインの中に書き出す、D348）を一時の workspace で組ごと生成して見る。
// 実行: pnpm test scripts/structure/domain/tests/parentOutputs.test.mjs
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createWorkspace } from "../domain/workspace.mjs";
import { generateWithPairs, loadDomainForGenerate } from "../pipeline/generate.mjs";
import { collectionChildrenOf, resolvePairs } from "../pipeline/pairs.mjs";
import { collectionFieldPatches } from "../render/components/fields.mjs";
import { renderChildDomainConfigs } from "../render/collections/index.mjs";
import { renderCollectionsOutput } from "../render/registry/collections.mjs";
import { renderServerServices } from "../render/serverServices/index.mjs";
import { makeProject, removeAll, repoRoot } from "./helpers.mjs";
import { planDomain } from "../pipeline/plan.mjs";
import { generateTargets } from "../spec/categories.mjs";

const cleanup = [];
after(() => removeAll(cleanup));

const SILENT = { log() {}, warn() {} };
const showcase = JSON.parse(fs.readFileSync(path.join(repoRoot, "scripts/structure/domain/tests/fixtures/parity/synthetic/showcase/entities/showcase/entity.json"), "utf8"));

function generateShowcase(config = showcase) {
  const root = makeProject({ templates: ["components"], configs: { showcase: config }, cleanup });
  const workspace = createWorkspace(root);
  const ctx = loadDomainForGenerate(workspace, "showcase", SILENT);
  generateWithPairs(ctx, workspace, { entities: true, components: true }, { only: ["entities", "components"], io: SILENT });
  const read = (rel) => fs.readFileSync(path.join(root, "src", "domains", "showcase", rel), "utf8");
  return { root, workspace, read };
}

test("drizzle: 集まりの項目は列を出さない（型名の列関数も import しない）。表に集まりを遅延で登録する", () => {
  const { root, read } = generateShowcase();
  const drizzle = read("entities/showcase/drizzle.ts");
  assert.doesNotMatch(drizzle, /photos/);
  assert.doesNotMatch(drizzle, /mediaCollection/);
  assert.match(drizzle, /brochure: text\("brochure"\)/);
  assert.match(drizzle, /^import \{ defineTableCollections \} from "@\/lib\/crud\/server";$/m);
  assert.match(
    drizzle,
    /^defineTableCollections\(ShowcaseTable, \(\) => import\("@\/domains\/showcase\/services\/server\/showcaseCollections"\)\.then\(\(m\) => m\.collections\)\);$/m,
  );
  // 従属（集まりを持たない）には出さない
  const child = fs.readFileSync(path.join(root, "src", "domains", "showcase", "entities", "showcasePhoto", "drizzle.ts"), "utf8");
  assert.equal(fs.existsSync(path.join(root, "src", "domains", "showcasePhoto")), false, "従属はドメインのフォルダを作らない");
  assert.doesNotMatch(child, /defineTableCollections/);
});

test("スキーマ: 値は複数枚の行と同じ z.array(storageMediaValueSchema)、required → min(1)、collection.maxItems → max", () => {
  const schema = generateShowcase().read("entities/showcase/schema.ts");
  assert.match(
    schema,
    /photos: z\.array\(storageMediaValueSchema\)\.min\(1, \{ message: "写真は1件以上必要です。" \}\)\.max\(8, \{ message: "写真は8件以下にしてください。" \}\)\.default\(\[\]\),/,
  );
  assert.match(schema, /import \{ storageMediaValueSchema \} from "@\/lib\/storage";/);
});

test("スキーマ: 必須でなく最大件数も無い集まりは min / max を付けない", () => {
  const fields = showcase.fields.map((f) => (f.name === "photos" ? { ...f, required: false, collection: { registration: "showcase_photo" } } : f));
  const schema = generateShowcase({ ...showcase, fields }).read("entities/showcase/schema.ts");
  assert.match(schema, /photos: z\.array\(storageMediaValueSchema\)\.default\(\[\]\),/);
});

test("モデル: 省略可の string[]（表の列ではないので belongsToMany と同じく省略可）", () => {
  assert.match(generateShowcase().read("entities/showcase/model.ts"), /^ {2}photos\?: string\[\];$/m);
});

test("Fields: 従属の file の用途・accept・上限サイズと、集まりの件数を載せる（この実行で書き出す従属の中身から）", () => {
  const fieldsTsx = generateShowcase().read("components/common/ShowcaseFields.tsx");
  assert.match(fieldsTsx, /const COLLECTION_FIELD_PATCHES: Record<string, Partial<FieldConfig>> = \{\n {2}photos: \{"purpose":"showcasePhoto\.file","accept":"image\/\*","validationRule":\{"maxSizeBytes":10485760,"maxItems":8,"minItems":1\}\},\n\};/);
  assert.match(fieldsTsx, /brochure: "showcase\.brochure",/);
  assert.match(fieldsTsx, /return field\.name in COLLECTION_FIELD_PATCHES \? \{ \.\.\.withPurpose, \.\.\.COLLECTION_FIELD_PATCHES\[field\.name\] \} : withPurpose;/);
});

test("Fields: 既にある従属の entity.json の file の条件を読み、用途は collection.registration に従う", () => {
  const fields = showcase.fields.map((f) => (f.name === "photos" ? { ...f, required: false, collection: { registration: "gallery_shot" } } : f));
  const owner = { ...showcase, fields };
  const { workspace } = generateShowcase(owner);
  const pairs = resolvePairs(workspace);
  const [{ patch }] = collectionFieldPatches(owner, collectionChildrenOf(workspace, pairs, "showcase"));
  assert.deepEqual(patch, { purpose: "galleryShot.file", accept: "image/*", validationRule: { maxSizeBytes: 10485760 } });

  const childPath = workspace.registrationConfigPath("showcase", "galleryShot");
  const child = JSON.parse(fs.readFileSync(childPath, "utf8"));
  child.fields[0] = { ...child.fields[0], accept: "image/png", validationRule: { maxSizeBytes: 2048 } };
  fs.writeFileSync(childPath, JSON.stringify(child));
  const [{ patch: fromDisk }] = collectionFieldPatches(owner, collectionChildrenOf(workspace, resolvePairs(workspace), "showcase"));
  assert.deepEqual(fromDisk, { purpose: "galleryShot.file", accept: "image/png", validationRule: { maxSizeBytes: 2048 } });
});

test("Fields: 従属が分からなくても用途名は collection.registration から出す（直接 render を呼ぶ経路）", () => {
  const [{ patch }] = collectionFieldPatches(showcase);
  assert.deepEqual(patch, { purpose: "showcasePhoto.file", validationRule: { maxItems: 8, minItems: 1 } });
});

// ---- 配線: <登録名>Collections.ts（registry）・<登録名>Base の import と options・手書きの土台への案内 ----

function ownerContext(config = showcase) {
  const root = makeProject({ templates: ["services"], configs: { showcase: config, plainThing: { ...config, singular: "plain_thing", plural: "plain_things", fields: config.fields.filter((f) => f.fieldType !== "mediaCollection") } }, cleanup });
  const workspace = createWorkspace(root);
  const pairs = resolvePairs(workspace);
  const ctx = loadDomainForGenerate(workspace, "showcase", SILENT);
  ctx.collectionChildren = collectionChildrenOf(workspace, pairs, "showcase");
  return { workspace, ctx };
}
const contentOf = (outputs, name) => outputs.find((out) => out.path?.endsWith(name))?.content;

test("<登録名>Collections.ts: 集まりの項目ごとに CrudCollectionConfig（従属のサービス・列・件数・複製）を書く。集まりの無い主には出さない", () => {
  const { workspace, ctx } = ownerContext();
  const collections = contentOf(renderCollectionsOutput(ctx), "services/server/showcaseCollections.ts");
  assert.equal(
    collections.split("\n").slice(6).join("\n"), // 先頭 = パスの行・生成物の印・注釈 4 行
    [
      'import type { CrudCollectionConfig } from "@/lib/crud/server";',
      'import { ShowcasePhotoTable } from "@/domains/showcase/entities/drizzle";',
      "",
      "export const collections: CrudCollectionConfig[] = [",
      "  {",
      '    fieldName: "photos",',
      '    service: () => import("@/domains/showcase/services/server/showcasePhotoService").then((m) => m.showcasePhotoService),',
      "    parentColumn: ShowcasePhotoTable.showcase_id,",
      "    valueColumn: ShowcasePhotoTable.file,",
      "    sortColumn: ShowcasePhotoTable.sort_order,",
      "    maxItems: 8,",
      "    minItems: 1,",
      "    duplicate: true,",
      "  },",
      "];",
      "",
    ].join("\n"),
  );
  const plain = loadDomainForGenerate(workspace, "plainThing", SILENT);
  assert.deepEqual(renderCollectionsOutput(plain), []);
});

test("<登録名>Base: 集まりを持つ主だけ collections を import して options に渡す。集まりの無い主の土台は変わらない", () => {
  const { workspace, ctx } = ownerContext();
  const owner = contentOf(renderServerServices(ctx, workspace), "showcaseBase.ts");
  assert.match(owner, /^import \{ collections \} from "\.\/showcaseCollections";$/m);
  assert.match(owner, /^ {2}collections,$/m);
  const plainCtx = loadDomainForGenerate(workspace, "plainThing", SILENT);
  const plain = contentOf(renderServerServices(plainCtx, workspace), "plainThingBase.ts");
  assert.doesNotMatch(plain, /collections/);
  const ownerWithoutCollections = owner
    .replace('import { collections } from "./showcaseCollections";\n', "")
    .replace(/ {2}\/\/ 主の集まりの項目[^\n]*\n {2}collections,\n/, "");
  assert.equal(ownerWithoutCollections.replace(/showcase/g, "x").replace(/Showcase/g, "X"), plain.replace(/plain_things|plainThing/g, "x").replace(/PlainThing/g, "X"));
});

test("主が generate: false（手で管理）なら何も書かない。カテゴリを名指ししても何も書かない（生成器を通さない）", () => {
  const { workspace, ctx } = ownerContext({ ...showcase, generate: false });
  assert.deepEqual(planDomain(ctx, workspace, generateTargets(ctx.config)), []);
  assert.deepEqual(planDomain(ctx, workspace, { ...generateTargets(ctx.config), serverServices: true }), []);
});
