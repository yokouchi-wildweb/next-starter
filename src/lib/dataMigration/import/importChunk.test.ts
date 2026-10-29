// src/lib/dataMigration/import/importChunk.test.ts
//
// import の型変換（getFieldTypes / convertRecordTypes）のテスト。配列は型の表の array 属性（array・stringArray）で判定し、
// 主の集まり（mediaCollection）は配列にしない。日時・数値の判定は型名の比較のまま。
// 実行: pnpm test:data-migration

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { convertRecordTypes, getFieldTypes } from "./importChunk";

const fields = [
  { name: "tags", fieldType: "array" },
  { name: "labels", fieldType: "stringArray" },
  { name: "images", fieldType: "mediaCollection" },
  { name: "name", fieldType: "string" },
  { name: "count", fieldType: "integer" },
  { name: "price", fieldType: "numeric(10,2)" },
  { name: "day", fieldType: "date" },
  { name: "at", fieldType: "timestamp With Time Zone" },
];

describe("import の型変換", () => {
  const { arrayFields, dateFields, numberFields } = getFieldTypes(fields);

  test("配列は array・stringArray。mediaCollection は配列にしない", () => {
    assert.deepEqual([...arrayFields].sort(), ["labels", "tags"]);
  });

  test("日時・数値の判定は今のまま（numeric(10,2) は数値にしない）", () => {
    assert.deepEqual([...dateFields].sort(), ["at", "day"]);
    assert.deepEqual([...numberFields].sort(), ["count"]);
  });

  test("stringArray の \"a,b\" は配列で入る", () => {
    const converted = convertRecordTypes(
      { tags: "x, y", labels: "a,b", images: "p,q", name: "a,b", count: "3" },
      arrayFields,
      dateFields,
      numberFields,
    );
    assert.deepEqual(converted, { tags: ["x", "y"], labels: ["a", "b"], images: "p,q", name: "a,b", count: 3 });
  });

  test("stringArray の空欄は空配列", () => {
    assert.deepEqual(convertRecordTypes({ labels: "" }, arrayFields, dateFields, numberFields), { labels: [] });
  });
});
