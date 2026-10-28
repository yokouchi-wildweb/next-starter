// dc:generate のメディア列の生成出力（スキーマ・presenters・Fields コンポーネント）の回帰テスト。
// ファイル用途の登録表のエントリ（storage.read → read.allow）もここで見る。
// drizzleBase の storage binding と Firestore の生成エラーは serverServiceWriteOnce.test.mjs で見る。
// 実行: pnpm test:dc-storage-output
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { generateFieldsFromConfig } from "../render/components/fields.mjs";
import { renderSchema } from "../render/entities/schema.mjs";
import { renderPresentersContent } from "../render/presenters/index.mjs";
import { buildStoragePurposeEntries } from "../render/registry/storagePurpose/entries.mjs";
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

test("presenters: 主の集まりの項目は formatCollectionThumbnails（import も足す）、旧来の複数メディア列は formatMediaThumbnails のまま", () => {
  const gallery = { name: "gallery", label: "ギャラリー", fieldType: "mediaCollection", formInput: "mediaUploaderMulti", collection: { domain: "album_gallery" } };
  const { ctx, workspace } = albumContext({ ...FIXTURE, fields: [...FIXTURE.fields, gallery] });
  const presenters = renderPresentersContent(ctx, workspace);
  assert.match(presenters, /gallery: \(\{ value, field, record \}\) => formatCollectionThumbnails\(value\),/);
  assert.match(presenters, /photos: \(\{ value, field, record \}\) => formatMediaThumbnails\(value\),/);
  assert.match(presenters, /formatMediaThumbnails,\n\s+formatCollectionThumbnails,\n\} from "@\/lib\/crud";/);
  const { ctx: legacyCtx, workspace: legacyWorkspace } = albumContext(FIXTURE);
  assert.doesNotMatch(renderPresentersContent(legacyCtx, legacyWorkspace), /formatCollectionThumbnails/);
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

// ---- ファイル用途のエントリ（storagePurposeRegistry の AUTO ブロックの値） ----

const purposeOf = (storage, apiAccess = { read: "authenticated", write: { roleCategories: ["admin"] } }) => {
  const field = { name: "doc", label: "書類", fieldType: "mediaUploader", formInput: "mediaUploader", accept: "application/pdf", validationRule: { maxSizeBytes: 1000 } };
  return buildStoragePurposeEntries({ camel: "album", config: { apiAccess, fields: [{ ...field, ...(storage ? { storage } : {}) }] } });
};

test("用途: storage.read が無ければ apiAccess の get の規則（今のまま）", () => {
  const { entries, errors } = purposeOf(undefined);
  assert.deepEqual(errors, []);
  assert.match(entries[0].value, /visibility: "private"/);
  assert.match(entries[0].value, /read: \{ allow: "authenticated" \}/);
  assert.match(purposeOf(undefined, { read: "public", write: { roleCategories: ["admin"] } }).entries[0].value, /visibility: "public"/);
});

test("用途: storage.read があれば read.allow に優先して出す（private に public も書ける）", () => {
  const roles = purposeOf({ visibility: "private", read: { roles: ["editor"] } });
  assert.match(roles.entries[0].value, /read: \{ allow: \{ roles: \["editor"\] \} \}/);
  const open = purposeOf({ visibility: "private", read: "public" });
  assert.deepEqual(open.errors, []);
  assert.match(open.entries[0].value, /visibility: "private"/);
  assert.match(open.entries[0].value, /read: \{ allow: "public" \}/);
});

test("用途: visibility を省けば storage.read から導く（public → public、それ以外 → private）", () => {
  assert.match(purposeOf({ read: "public" }).entries[0].value, /visibility: "public"/);
  assert.doesNotMatch(purposeOf({ read: "public" }).entries[0].value, /read:/);
  const closed = purposeOf({ read: "none" }, { read: "public", write: { roleCategories: ["admin"] } });
  assert.match(closed.entries[0].value, /visibility: "private"/);
  assert.match(closed.entries[0].value, /read: \{ allow: "none" \}/);
});

test("用途: storage.read が規則でなければ生成エラー", () => {
  const { entries, errors } = purposeOf({ visibility: "private", read: "everyone" });
  assert.equal(entries.length, 0);
  assert.match(errors.join("\n"), /storage\.read は "public" \/ "authenticated" \/ "none"/);
});
