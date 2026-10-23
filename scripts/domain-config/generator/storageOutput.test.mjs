// dc:generate のメディア列の生成出力（スキーマ・presenters・Fields コンポーネント）の回帰テスト。
// drizzleBase の storage binding と Firestore の生成エラーは serverServiceWriteOnce.test.mjs で見る。
// 実行: pnpm test:dc-storage-output
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateFieldsFromConfig } from "./components/utils/fields.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const generatorDir = path.join(repoRoot, "scripts", "domain-config", "generator");
const tmpDirs = [];
after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});

const FIXTURE = {
  singular: "album",
  plural: "albums",
  dbEngine: "Neon",
  idType: "uuid",
  fields: [
    { name: "title", label: "タイトル", fieldType: "string", formInput: "textInput", required: true },
    { name: "cover", label: "表紙", fieldType: "mediaUploader", formInput: "mediaUploader", required: true },
    { name: "thumbnail", label: "サムネイル", fieldType: "mediaUploader", formInput: "mediaUploader" },
    { name: "photos", label: "写真", fieldType: "mediaUploaderMulti", formInput: "mediaUploaderMulti", validationRule: { maxItems: 5 } },
  ],
};

// ジェネレーターは process.cwd() の src/features を見るので、テンプレートと fixture を一時ディレクトリに置いて実行する
function makeProject(config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dc-storage-output-"));
  tmpDirs.push(dir);
  fs.mkdirSync(path.join(dir, "src", "features", "_template"), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, "src", "features", "_template", "presenters.ts"), path.join(dir, "src", "features", "_template", "presenters.ts"));
  fs.mkdirSync(path.join(dir, "src", "features", "album"), { recursive: true });
  fs.writeFileSync(path.join(dir, "src", "features", "album", "domain.json"), JSON.stringify(config));
  return dir;
}

function run(cwd, script) {
  const result = spawnSync("node", [path.join(generatorDir, script), "album"], { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

const read = (root, rel) => fs.readFileSync(path.join(root, "src", "features", "album", rel), "utf8");

test("スキーマ: メディア列は storageMediaValueSchema、複数列は z.array(storageMediaValueSchema)", () => {
  const root = makeProject(FIXTURE);
  run(root, path.join("entities", "generate-schema.mjs"));
  const schema = read(root, path.join("entities", "schema.ts"));
  assert.match(schema, /import \{ storageMediaValueSchema \} from "@\/lib\/storage\/schema";/);
  assert.match(schema, /cover: z\.string\(\)\.trim\(\)\.min\(1, \{ message: "表紙は必須です。" \}\)\.pipe\(storageMediaValueSchema\),/);
  assert.match(schema, /thumbnail: z\.string\(\)\.trim\(\)\.nullish\(\)\n\s+\.transform\(\(value\) => emptyToNull\(value\)\)\n\s+\.pipe\(storageMediaValueSchema\.nullish\(\)\),/);
  assert.match(schema, /photos: z\.array\(storageMediaValueSchema\)\.max\(5, /);
});

test("スキーマ: メディア列が無ければ storageMediaValueSchema を import しない", () => {
  const root = makeProject({ ...FIXTURE, fields: [FIXTURE.fields[0]] });
  run(root, path.join("entities", "generate-schema.mjs"));
  assert.doesNotMatch(read(root, path.join("entities", "schema.ts")), /storageMediaValueSchema/);
});

test("presenters: メディア列を resolveStorageSrc で解決するサムネイルにする", () => {
  const root = makeProject(FIXTURE);
  run(root, path.join("components", "presenters.mjs"));
  const presenters = read(root, "presenters.ts");
  assert.match(presenters, /cover: \(\{ value, field, record \}\) => formatMediaThumbnail\(value\),/);
  assert.match(presenters, /thumbnail: \(\{ value, field, record \}\) => formatMediaThumbnail\(value\),/);
  assert.match(presenters, /photos: \(\{ value, field, record \}\) => formatMediaThumbnails\(value\),/);
  assert.match(presenters, /formatMediaThumbnail,\n\s+formatMediaThumbnails,\n\} from "@\/lib\/crud";/);
});

test("Fields: メディア列に purpose `<domain>.<field>` を付けて FieldRenderer に渡す", () => {
  const fields = generateFieldsFromConfig(FIXTURE).replace(/__domain__/g, "album").replace(/__Domain__/g, "Album");
  assert.match(fields, /cover: "album\.cover",\n\s+thumbnail: "album\.thumbnail",\n\s+photos: "album\.photos",/);
  assert.match(fields, /baseFields=\{baseFields\}/);
  assert.doesNotMatch(fields, /title: "album\.title"/);

  const plain = generateFieldsFromConfig({ ...FIXTURE, fields: [FIXTURE.fields[0]] });
  assert.doesNotMatch(plain, /STORAGE_PURPOSES/);
  assert.match(plain, /const baseFields = \(domainConfig\.fields \?\? \[\]\) as FieldConfig\[\];/);
});
