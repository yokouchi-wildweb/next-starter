// dc:generate のメディア列の生成出力（スキーマ・presenters・Fields コンポーネント）の回帰テスト。
// drizzleBase の storage binding と Firestore の生成エラーは serverServiceWriteOnce.test.mjs で見る。
// 実行: pnpm test:dc-storage-output
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { generateFieldsFromConfig } from "../render/components/fields.mjs";
import { renderSchema } from "../render/entities/schema.mjs";
import { renderPresentersContent } from "../render/presenters/index.mjs";
import { contextFor, makeProject, removeAll } from "./helpers.mjs";

const cleanup = [];
after(() => removeAll(cleanup));

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

function albumContext(config) {
  const root = makeProject({ templates: ["presenters.ts"], configs: { album: config }, cleanup });
  return contextFor(root, "album");
}

test("スキーマ: メディア列は storageMediaValueSchema、複数列は z.array(storageMediaValueSchema)", () => {
  const { ctx } = albumContext(FIXTURE);
  const schema = renderSchema(ctx);
  assert.match(schema, /import \{ storageMediaValueSchema \} from "@\/lib\/storage\/schema";/);
  assert.match(schema, /cover: z\.string\(\)\.trim\(\)\.min\(1, \{ message: "表紙は必須です。" \}\)\.pipe\(storageMediaValueSchema\),/);
  assert.match(schema, /thumbnail: z\.string\(\)\.trim\(\)\.nullish\(\)\n\s+\.transform\(\(value\) => emptyToNull\(value\)\)\n\s+\.pipe\(storageMediaValueSchema\.nullish\(\)\),/);
  assert.match(schema, /photos: z\.array\(storageMediaValueSchema\)\.max\(5, /);
});

test("スキーマ: メディア列が無ければ storageMediaValueSchema を import しない", () => {
  const { ctx } = albumContext({ ...FIXTURE, fields: [FIXTURE.fields[0]] });
  assert.doesNotMatch(renderSchema(ctx), /storageMediaValueSchema/);
});

test("presenters: メディア列を resolveStorageSrc で解決するサムネイルにする", () => {
  const { ctx, workspace } = albumContext(FIXTURE);
  const presenters = renderPresentersContent(ctx, workspace);
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
