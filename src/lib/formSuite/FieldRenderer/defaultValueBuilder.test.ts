// src/lib/formSuite/FieldRenderer/defaultValueBuilder.test.ts
// buildFormDefaultValues の単体テスト（fieldType ごとの既定値）。ドメインの写し・作成の schema との突き合わせは各ドメインの
// entities/formDefaults.test.ts(lib はドメインを読まない)。
// 初期値・checkbox の複数選択・編集時の日時変換は型の表（src/lib/domain/fields/fieldTypes.mjs）から引くので、
// 表の行ごとの答えを期待値の literal で固定する。dc の選択肢の表(fieldFormInputs.mjs)の型が型の表にあるかも見る
// 実行: pnpm test src/lib/formSuite/FieldRenderer/defaultValueBuilder.test.ts

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { isCheckGroupFieldType } from "../Field/Configured/checkGroupFieldTypes";
import { isCheckboxArray } from "../Field/Configured/inputResolver";
import { FIELD_TYPES } from "@/lib/domain";
import { FORM_INPUTS } from "@/lib/domain";

import { buildFormDefaultValues } from "./defaultValueBuilder";

describe("buildFormDefaultValues: 既定の分岐", () => {
  test("fieldType が無い項目は既定の分岐(空文字)に落ちる", () => {
    const config = { fields: [{ name: "a" }], relations: [] } as const;
    assert.deepEqual(buildFormDefaultValues(config), { a: "" });
    assert.deepEqual(buildFormDefaultValues(config, {}), { a: "" });
  });
});

describe("buildFormDefaultValues: fieldType ごとの既定値", () => {
  const config = {
    fields: [
      { name: "str", fieldType: "string" },
      { name: "int", fieldType: "integer" },
      { name: "bool", fieldType: "boolean" },
      { name: "radioBool", fieldType: "boolean", formInput: "radio" },
      { name: "en", fieldType: "enum" },
      { name: "arr", fieldType: "array" },
      { name: "ts", fieldType: "timestamp With Time Zone" },
      { name: "media", fieldType: "mediaUploader" },
      { name: "gallery", fieldType: "mediaUploaderMulti" },
      { name: "json", fieldType: "jsonb" },
      { name: "fsMap", fieldType: "map" },
    ],
  };

  test("作成時の既定値", () => {
    assert.deepEqual(buildFormDefaultValues(config), {
      str: "",
      int: undefined,
      bool: false,
      radioBool: undefined,
      en: undefined,
      arr: [],
      ts: undefined,
      media: "",
      gallery: [],
      json: undefined,
      fsMap: undefined,
    });
  });

  test("field.defaultValue が優先される（object も可）", () => {
    const values = buildFormDefaultValues({
      fields: [
        { name: "json", fieldType: "jsonb", defaultValue: { a: 1 } },
        { name: "gallery", fieldType: "mediaUploaderMulti", defaultValue: ["x"] },
      ],
    });
    assert.deepEqual(values, { json: { a: 1 }, gallery: ["x"] });
  });

  test("編集時は entity の値が優先され、null は既定値で埋まる", () => {
    const values = buildFormDefaultValues(config, {
      gallery: ["storage://a"],
      json: { k: "v" },
      arr: null,
      ts: "2026-01-01T00:00:00.000Z",
    });
    assert.deepEqual(values.gallery, ["storage://a"]);
    assert.deepEqual(values.json, { k: "v" });
    assert.deepEqual(values.arr, []);
    assert.ok(values.ts instanceof Date);
  });
});

// ---- 型の表（src/lib/domain/fields/fieldTypes.mjs）の行ごとの答え ----

// 表の全行: [作成時の初期値, checkbox を複数選択にするか, 編集時に Date にするか]。行を足したらここにも足す（下のテストが漏れを落とす）
const EXPECTED_BY_FIELD_TYPE: Record<string, [unknown, boolean, boolean]> = {
  string: ["", false, false],
  email: ["", false, false],
  password: ["", false, false],
  uuid: ["", false, false],
  mediaUploader: ["", false, false],
  integer: [undefined, false, false],
  number: [undefined, false, false],
  float: [undefined, false, false],
  bigint: [undefined, false, false],
  "numeric(10,2)": [undefined, false, false],
  boolean: [false, false, false],
  date: ["", false, false],
  time: ["", false, false],
  timestamp: [undefined, false, true],
  "timestamp With Time Zone": [undefined, false, true],
  jsonb: [undefined, false, false],
  array: [[], true, false],
  stringArray: [[], true, false],
  enum: [undefined, false, false],
  mediaCollection: [[], false, false],
  Point: ["", false, false],
  map: [undefined, false, false],
  geopoint: ["", false, false],
  reference: ["", false, false],
  null: ["", false, false],
  mediaUploaderMulti: [[], false, false],
};

// 表に無い型（未知型）: 初期値 ""・複数選択なし・Date にしない。型名は小文字化しないので小文字の timestamp with time zone も未知型
const UNKNOWN_FIELD_TYPES = ["timestamp with time zone", "uuid[]", "text", "decimal"];

const ISO = "2026-01-01T00:00:00.000Z";

describe("型の表の行ごとの答え", () => {
  test("期待値の一覧が表の全行と一致する（行を足したら期待値も足す）", () => {
    assert.deepEqual(Object.keys(EXPECTED_BY_FIELD_TYPE).sort(), Object.keys(FIELD_TYPES).sort());
  });

  test("全行が formDefault を明示している", () => {
    for (const [fieldType, row] of Object.entries(FIELD_TYPES)) {
      assert.ok(Object.hasOwn(row, "formDefault"), `${fieldType} に formDefault が無い`);
    }
  });

  for (const [fieldType, [createValue, checkGroup, toDate]] of Object.entries(EXPECTED_BY_FIELD_TYPE)) {
    test(`${fieldType}: 作成時 ${JSON.stringify(createValue) ?? "undefined"} / 複数選択 ${checkGroup} / 編集時 Date ${toDate}`, () => {
      assert.deepEqual(buildFormDefaultValues({ fields: [{ name: "x", fieldType }] }).x, createValue);
      assert.equal(isCheckGroupFieldType(fieldType), checkGroup);
      const edited = buildFormDefaultValues({ fields: [{ name: "x", fieldType }] }, { x: ISO }).x;
      if (toDate) assert.ok(edited instanceof Date && edited.toISOString() === ISO);
      else assert.equal(edited, ISO);
    });
  }

  for (const fieldType of UNKNOWN_FIELD_TYPES) {
    test(`未知型 "${fieldType}": 初期値 ""・複数選択なし・編集時も Date にしない`, () => {
      assert.equal(buildFormDefaultValues({ fields: [{ name: "x", fieldType }] }).x, "");
      assert.equal(isCheckGroupFieldType(fieldType), false);
      assert.equal(buildFormDefaultValues({ fields: [{ name: "x", fieldType }] }, { x: ISO }).x, ISO);
    });
  }

  test("boolean は選択肢のある項目（radio か options あり）だけ undefined", () => {
    const values = buildFormDefaultValues({
      fields: [
        { name: "plain", fieldType: "boolean", formInput: "checkbox" },
        { name: "radio", fieldType: "boolean", formInput: "radio" },
        { name: "opts", fieldType: "boolean", options: [{ value: true, label: "はい" }] },
        { name: "emptyOpts", fieldType: "boolean", options: [] },
        { name: "strOpts", fieldType: "string", options: [{ value: "a", label: "A" }] },
      ],
    });
    assert.deepEqual(values, { plain: false, radio: undefined, opts: undefined, emptyOpts: false, strOpts: "" });
  });

  test("配列の初期値は呼ぶたびに新しい配列（フォーム同士で共有しない）", () => {
    const config = { fields: [{ name: "x", fieldType: "array" }] };
    const a = buildFormDefaultValues(config).x as string[];
    const b = buildFormDefaultValues(config).x as string[];
    assert.notEqual(a, b);
    a.push("mutated");
    assert.deepEqual(buildFormDefaultValues(config).x, []);
    assert.deepEqual(FIELD_TYPES.array.formDefault, []);
  });
});

// ---- dc の選択肢の表と型の表の突き合わせ(型の名前の union は @/lib/domain の fieldTypeNames.ts が表から導く) ----

describe("dc の選択肢の表が型の表とずれていない", () => {
  test("dc の選択肢に出る型はすべて表にある", () => {
    for (const engine of Object.keys(FORM_INPUTS) as Array<keyof typeof FORM_INPUTS>) {
      for (const fieldType of Object.keys(FORM_INPUTS[engine])) {
        assert.ok(Object.hasOwn(FIELD_TYPES, fieldType), `${engine} / ${fieldType} が型の表に無い`);
      }
    }
  });
});

describe("isCheckboxArray: checkbox かつ値が配列の型（型の表の array 属性）", () => {
  test("array・stringArray の checkbox だけ true", () => {
    assert.equal(isCheckboxArray({ name: "x", label: "x", formInput: "checkbox", fieldType: "array" }), true);
    assert.equal(isCheckboxArray({ name: "x", label: "x", formInput: "checkbox", fieldType: "stringArray" }), true);
    assert.equal(isCheckboxArray({ name: "x", label: "x", formInput: "checkbox", fieldType: "boolean" }), false);
    assert.equal(isCheckboxArray({ name: "x", label: "x", formInput: "checkbox", fieldType: "mediaUploaderMulti" }), false);
    assert.equal(isCheckboxArray({ name: "x", label: "x", formInput: "multiSelect", fieldType: "array" }), false);
  });

  test("答えは isCheckGroupFieldType と同じ（表の全行）", () => {
    for (const fieldType of Object.keys(FIELD_TYPES)) {
      assert.equal(
        isCheckboxArray({ name: "x", label: "x", formInput: "checkbox", fieldType }),
        isCheckGroupFieldType(fieldType),
        fieldType,
      );
    }
  });
});
