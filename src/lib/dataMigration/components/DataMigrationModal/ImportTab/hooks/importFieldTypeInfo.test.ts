// src/lib/dataMigration/components/DataMigrationModal/ImportTab/hooks/importFieldTypeInfo.test.ts
// インポート画面が送るフィールド情報のテスト
// 実行: pnpm test src/lib/dataMigration/components/DataMigrationModal/ImportTab/hooks/importFieldTypeInfo.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildImportFieldTypeInfo } from "./importFieldTypeInfo";

test("集まりの項目を持つドメイン: 集まりの項目だけ送らず、他は順番どおり送る", () => {
  const sent = buildImportFieldTypeInfo([
    { name: "id", label: "ID" },
    { name: "name", label: "名前", fieldType: "string" },
    { name: "main_image", label: "メイン画像", fieldType: "mediaUploader", isImageField: true },
    { name: "images", label: "画像", fieldType: "mediaCollection" },
    { name: "price", label: "価格", fieldType: "integer" },
  ]);

  assert.deepEqual(sent, [
    { name: "id", fieldType: undefined },
    { name: "name", fieldType: "string" },
    { name: "main_image", fieldType: "mediaUploader" },
    { name: "price", fieldType: "integer" },
  ]);
});

test("集まりの項目が無いドメイン: 全項目をそのまま送る", () => {
  const sent = buildImportFieldTypeInfo([
    { name: "name", label: "名前", fieldType: "string" },
    { name: "tags", label: "タグ", fieldType: "array" },
    { name: "createdAt", label: "作成日時" },
  ]);

  assert.deepEqual(sent, [
    { name: "name", fieldType: "string" },
    { name: "tags", fieldType: "array" },
    { name: "createdAt", fieldType: undefined },
  ]);
});
