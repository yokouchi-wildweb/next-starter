// dc:generate の serverServices: <domain>Service.ts は書き捨て（無いときだけ生成）、drizzleBase.ts は毎回生成する回帰テスト。
// メディア列の storage binding 出力（Firestore・廃止した型は生成エラー）もここで見る。
// 実行: pnpm test:dc-server-service
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadDomainForGenerate } from "../pipeline/generate.mjs";
import { renderServerServices } from "../render/serverServices/index.mjs";
import { applyAndCapture, contextFor, makeProject, removeAll } from "./helpers.mjs";

const cleanup = [];
after(() => removeAll(cleanup));

const project = (domains, configs) => makeProject({ templates: ["services"], domains, configs, cleanup });

function run(root, domain) {
  const { workspace, ctx } = contextFor(root, domain);
  return applyAndCapture(renderServerServices(ctx, workspace));
}

const serverDir = (root, domain) => path.join(root, "src", "features", domain, "services", "server");

test("<domain>Service.ts が無ければ drizzleBase.ts と一緒に生成する", () => {
  const root = project(["sampleTag"]);
  run(root, "sampleTag");
  assert.ok(fs.existsSync(path.join(serverDir(root, "sampleTag"), "sampleTagService.ts")));
  assert.ok(fs.existsSync(path.join(serverDir(root, "sampleTag"), "drizzleBase.ts")));
  assert.ok(fs.existsSync(path.join(serverDir(root, "sampleTag"), "wrappers", ".gitkeep")));
});

test("既存の <domain>Service.ts は上書きせず、drizzleBase.ts は作り直す", () => {
  const root = project(["sampleTag"]);
  run(root, "sampleTag");
  const servicePath = path.join(serverDir(root, "sampleTag"), "sampleTagService.ts");
  const basePath = path.join(serverDir(root, "sampleTag"), "drizzleBase.ts");
  const handEdited = `${fs.readFileSync(servicePath, "utf8")}// 手で足した独自処理\n`;
  fs.writeFileSync(servicePath, handEdited);
  const generatedBase = fs.readFileSync(basePath, "utf8");
  fs.writeFileSync(basePath, "// 古い drizzleBase\n");

  const result = run(root, "sampleTag");
  assert.equal(fs.readFileSync(servicePath, "utf8"), handEdited);
  assert.equal(fs.readFileSync(basePath, "utf8"), generatedBase);
  assert.match(result.stdout, /既存のため生成しません/);
});

test("既存の <domain>Service.ts が旧 wrappers/duplicate を組み込んでいれば外すよう警告し、ラッパーは生成しない", () => {
  const root = project(["sample"]);
  const dir = serverDir(root, "sample");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "sampleService.ts"),
    'import { base } from "./drizzleBase";\nimport { duplicate } from "./wrappers/duplicate";\n\nexport const sampleService = { ...base, duplicate };\n',
  );
  const result = run(root, "sample");
  assert.match(result.stderr, /wrappers\/duplicate（旧ファイル複製）を組み込んでいます/);
  assert.ok(!fs.existsSync(path.join(dir, "wrappers", "duplicate.ts")));

  // 外していれば警告しない
  fs.writeFileSync(path.join(dir, "sampleService.ts"), 'import { base } from "./drizzleBase";\n\nexport const sampleService = { ...base };\n');
  assert.doesNotMatch(run(root, "sample").stderr, /旧ファイル複製/);
});

test("メディア列があれば drizzleBase に storage binding を出し、storageCleanupFields は出さない", () => {
  const root = project(["sample", "sampleTag"]);
  run(root, "sample");
  run(root, "sampleTag");
  const base = fs.readFileSync(path.join(serverDir(root, "sample"), "drizzleBase.ts"), "utf8");
  assert.match(base, /import \{ storageBindingFor \} from "@\/features\/core\/storageObject\/services\/server\/crudBinding";/);
  assert.match(base, /storage: storageBindingFor\("sample", \[/);
  assert.match(base, /\{ name: "main_image", purpose: "sample\.main_image", multi: false \}/);
  assert.match(base, /\{ name: "sub_image", purpose: "sample\.sub_image", multi: false \}/);
  assert.doesNotMatch(base, /storageCleanupFields|extractStorageFields/);
  // Service は binding が複製を担うので duplicate ラッパーを組み込まない
  assert.doesNotMatch(fs.readFileSync(path.join(serverDir(root, "sample"), "sampleService.ts"), "utf8"), /duplicate/);

  // メディア列の無いドメインには何も出さない
  const tagBase = fs.readFileSync(path.join(serverDir(root, "sampleTag"), "drizzleBase.ts"), "utf8");
  assert.doesNotMatch(tagBase, /storageBindingFor|storageCleanupFields|__storageBinding__|__StorageBindingImport__/);
});

test("廃止した mediaUploaderMulti の項目があれば、集まりへの移行を案内する生成エラーで止め、何も書かない", () => {
  const root = project([], {
    album: { singular: "album", plural: "albums", dbEngine: "Neon", idType: "uuid", fields: [{ name: "photos", fieldType: "mediaUploaderMulti", formInput: "mediaUploaderMulti" }] },
  });
  const { workspace } = contextFor(root, "album");
  assert.throws(
    () => loadDomainForGenerate(workspace, "album", { log() {}, warn() {} }),
    /\[album\] fields "photos": fieldType "mediaUploaderMulti" は廃止しました。.*mediaCollection/,
  );
  assert.ok(!fs.existsSync(path.join(serverDir(root, "album"), "drizzleBase.ts")));
});

test("Firestore ドメインにメディア列があれば生成エラーで止め、何も書かない", () => {
  const root = project([], {
    memo: { singular: "memo", plural: "memos", dbEngine: "Firestore", idType: "uuid", fields: [{ name: "image", fieldType: "mediaUploader", formInput: "mediaUploader" }] },
  });
  assert.throws(() => run(root, "memo"), /Firestore ドメインにはメディア列/);
  assert.ok(!fs.existsSync(path.join(serverDir(root, "memo"), "firestoreBase.ts")));
});
