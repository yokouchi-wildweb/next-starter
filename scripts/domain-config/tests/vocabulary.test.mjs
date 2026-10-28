// domain.json の語彙検査（綴り違い・古いキー・その DB に無い型・知らない入力種別を警告する）の回帰テスト。
// 実行: pnpm test:dc-vocabulary
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { vocabularyWarnings } from "../checks/vocabulary.mjs";
import { repoRoot } from "./helpers.mjs";

const BASE = {
  domainConfigVersion: "1.3",
  singular: "memo",
  plural: "memos",
  label: "メモ",
  dbEngine: "Neon",
  idType: "uuid",
  relations: [],
  useCreatedAt: true,
  useUpdatedAt: true,
  fields: [{ name: "title", label: "題名", fieldType: "string", formInput: "textInput", required: true }],
  generateFiles: { entities: true },
};

test("正しい domain.json には警告が無い（このリポのサンプル 3 件を含む）", () => {
  assert.deepEqual(vocabularyWarnings(BASE), []);
  for (const domain of ["sample", "sampleCategory", "sampleTag"]) {
    const config = JSON.parse(fs.readFileSync(path.join(repoRoot, "src", "features", domain, "domain.json"), "utf8"));
    assert.deepEqual(vocabularyWarnings(config), [], domain);
  }
});

test("知らないトップレベルのキーと古いキー（version）を警告する", () => {
  const warnings = vocabularyWarnings({ ...BASE, version: "1.1", useSoftDelte: true });
  assert.match(warnings.join("\n"), /古いキー "version" は "domainConfigVersion"/);
  assert.match(warnings.join("\n"), /知らないキー "useSoftDelte"/);
});

test("その DB に無い fieldType と知らない formInput を警告する", () => {
  const warnings = vocabularyWarnings({
    ...BASE,
    fields: [
      { name: "ids", label: "ID", fieldType: "uuid[]", formInput: "custom" },
      { name: "at", label: "日時", fieldType: "timestamp with time zone", formInput: "datetimeInput" },
      { name: "pic", label: "画像", fieldType: "mediaUploader", formInput: "imageUploader" },
      { name: "color", label: "色", fieldType: "string", formInput: "colorInput", description: "x", uploadPath: "y" },
    ],
  });
  assert.match(warnings.join("\n"), /fields\[0\] "ids": fieldType "uuid\[\]" は Neon に無い型/);
  assert.match(warnings.join("\n"), /fields\[1\] "at": fieldType "timestamp with time zone" は Neon に無い型/);
  assert.match(warnings.join("\n"), /fields\[2\] "pic": formInput "imageUploader" は知らない入力種別/);
  assert.match(warnings.join("\n"), /fields\[3\] "color": 知らないキー "description"/);
  assert.match(warnings.join("\n"), /fields\[3\] "color": 知らないキー "uploadPath"/);
  assert.doesNotMatch(warnings.join("\n"), /colorInput/);
});

test("Firestore の型は Firestore の表で見る", () => {
  const fs = { ...BASE, dbEngine: "Firestore", fields: [{ name: "n", label: "n", fieldType: "number", formInput: "numberInput" }, { name: "i", label: "i", fieldType: "integer", formInput: "numberInput" }] };
  const warnings = vocabularyWarnings(fs);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /"integer" は Firestore に無い型/);
});

test("リレーションのキー・種別・onDelete・formInput を見る（旧 onDeleteCascade は移行を案内）", () => {
  const warnings = vocabularyWarnings({
    ...BASE,
    relations: [
      { domain: "vault", label: "v", fieldName: "vault_id", fieldType: "uuid", relationType: "belongsTo", onDeleteCascade: true },
      { domain: "tag", label: "t", fieldName: "tag_ids", fieldType: "uuid", relationType: "belongsToMany", formInput: "asyncCombobox" },
      { domain: "x", label: "x", fieldName: "x_id", relationType: "belongsToo", onDelete: "NULLIFY" },
    ],
  });
  const text = warnings.join("\n");
  assert.match(text, /relations\[0\] "vault": 古いキー "onDeleteCascade" は onDelete: "CASCADE"/);
  assert.match(text, /relations\[1\] "tag": formInput "asyncCombobox" は belongsToMany では使えません/);
  assert.match(text, /relations\[2\] "x": relationType "belongsToo"/);
  assert.match(text, /relations\[2\] "x": onDelete "NULLIFY"/);
});

test("generateFiles の知らないキーを警告する", () => {
  assert.match(vocabularyWarnings({ ...BASE, generateFiles: { entities: true, service: true } }).join("\n"), /generateFiles: 知らないキー "service"/);
});

test("主の集まりの項目（mediaCollection + collection）は警告なく通り、collection の下位キーの誤りは警告する", () => {
  const gallery = { name: "gallery", label: "ギャラリー", fieldType: "mediaCollection", formInput: "mediaUploaderMulti", required: true, reorderable: true };
  const ok = { ...BASE, fields: [...BASE.fields, { ...gallery, collection: { domain: "memoImage", maxItems: 10, duplicate: false } }] };
  assert.deepEqual(vocabularyWarnings(ok), []);
  assert.deepEqual(vocabularyWarnings({ ...BASE, fields: [...BASE.fields, { ...gallery, collection: { domain: "memoImage" } }] }), []);

  const text = vocabularyWarnings({
    ...BASE,
    fields: [
      { ...gallery, collection: { domain: "", maxItems: 0, duplicate: "no", minItems: 1 } },
      { ...gallery, name: "other", collection: ["memoImage"] },
    ],
  }).join("\n");
  assert.match(text, /fields\[0\] "gallery": collection: 知らないキー "minItems"/);
  assert.match(text, /fields\[0\] "gallery": collection\.domain は従属ドメインの singular/);
  assert.match(text, /fields\[0\] "gallery": collection\.maxItems は 1 以上の整数/);
  assert.match(text, /fields\[0\] "gallery": collection\.duplicate は true か false/);
  assert.match(text, /fields\[1\] "other": collection はオブジェクトで書いてください/);
});

test("mediaCollection は Firestore に無い型", () => {
  const warnings = vocabularyWarnings({
    ...BASE,
    dbEngine: "Firestore",
    fields: [{ name: "gallery", label: "g", fieldType: "mediaCollection", formInput: "mediaUploaderMulti", collection: { domain: "x" } }],
  });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /"mediaCollection" は Firestore に無い型/);
});
