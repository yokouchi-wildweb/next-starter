// src/lib/domain/fields/presenterFor.test.mjs
// presenterFor（項目を何で表示するか）のテスト。表の行ごとの答えと、順の境目（型の presenter が formInput より先、など）を固定する。
// 実行: pnpm test:presenter-for
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { FIELD_TYPES } from "./fieldTypes.mjs";
import { presenterFor } from "./presenterFor.mjs";

// 表の全行（formInput なし・選択肢なし）の答え。行を足したらここにも足す（下のテストが漏れを落とす）
const KIND_BY_FIELD_TYPE = {
  string: "string",
  email: "string",
  password: "string",
  uuid: "string",
  mediaUploader: "mediaThumbnail",
  integer: "number",
  number: "number",
  float: "number",
  bigint: "string",
  "numeric(10,2)": "string",
  boolean: "boolean",
  date: "string",
  time: "string",
  timestamp: "string",
  "timestamp With Time Zone": "string",
  jsonb: "string",
  array: "stringArray",
  stringArray: "stringArray",
  enum: "string",
  mediaCollection: "collectionThumbnails",
  Point: "string",
  map: "string",
  geopoint: "string",
  reference: "string",
  null: "string",
  mediaUploaderMulti: "string",
};

describe("presenterFor: 表の行ごとの答え（formInput なし）", () => {
  test("期待値の一覧が表の全行と一致する", () => {
    assert.deepEqual(Object.keys(KIND_BY_FIELD_TYPE).sort(), Object.keys(FIELD_TYPES).sort());
  });

  for (const [fieldType, kind] of Object.entries(KIND_BY_FIELD_TYPE)) {
    test(`${fieldType} → ${kind}`, () => {
      assert.deepEqual(presenterFor({ fieldType }), { kind });
    });
  }
});

describe("presenterFor: 順の境目", () => {
  const options = [{ value: "a", label: "A" }];

  test("型の presenter が formInput より先（integer + select → number、boolean + radio → boolean）", () => {
    assert.deepEqual(presenterFor({ fieldType: "integer", formInput: "select", options }), { kind: "number" });
    assert.deepEqual(presenterFor({ fieldType: "boolean", formInput: "radio" }), { kind: "boolean" });
  });

  test("enum は選択肢があれば enum（選択肢つき）、無ければ formInput を見ずに string", () => {
    assert.deepEqual(presenterFor({ fieldType: "enum", formInput: "select", options }), { kind: "enum", options });
    assert.deepEqual(presenterFor({ fieldType: "enum", formInput: "datetimeInput" }), { kind: "string" });
  });

  test("型の presenter が無ければ formInput で決める", () => {
    assert.deepEqual(presenterFor({ fieldType: "bigint", formInput: "numberInput" }), { kind: "number" });
    assert.deepEqual(presenterFor({ fieldType: "string", formInput: "stepperInput" }), { kind: "number" });
    assert.deepEqual(presenterFor({ fieldType: "string", formInput: "textarea" }), { kind: "string" });
    assert.deepEqual(presenterFor({ fieldType: "timestamp With Time Zone", formInput: "datetimeInput" }), { kind: "datetime" });
    assert.deepEqual(presenterFor({ fieldType: "date", formInput: "dateInput" }), { kind: "date" });
  });

  test("formInput が文字列入力ならメディアの型でも string（formInput が先）", () => {
    assert.deepEqual(presenterFor({ fieldType: "mediaUploader", formInput: "textInput" }), { kind: "string" });
  });

  test("メディア: 主の集まり → 先頭と +N、メディアの型か入力種別 → サムネイル", () => {
    assert.deepEqual(presenterFor({ fieldType: "mediaCollection", formInput: "mediaUploaderMulti" }), { kind: "collectionThumbnails" });
    assert.deepEqual(presenterFor({ fieldType: "mediaUploader", formInput: "mediaUploader" }), { kind: "mediaThumbnail" });
    assert.deepEqual(presenterFor({ fieldType: "string", formInput: "fileUploader" }), { kind: "mediaThumbnail" });
  });

  test("未知の型は string（入力種別がメディアならサムネイル）", () => {
    assert.deepEqual(presenterFor({ fieldType: "uuid[]" }), { kind: "string" });
    assert.deepEqual(presenterFor({ fieldType: "text", formInput: "mediaUploader" }), { kind: "mediaThumbnail" });
    assert.deepEqual(presenterFor({}), { kind: "string" });
  });
});
