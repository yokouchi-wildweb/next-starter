// src/components/Form/FieldRenderer/defaultValueBuilder.test.ts
// buildFormDefaultValues の単体テスト（fieldType ごとの既定値 / 作成フォームの既定値が schema を通るか）。
// フォーム側の型の手書き（既定値の switch・checkbox の複数選択・型の名前の union）が、生成器の型の表と
// ずれていないかも突き合わせる（型の解釈の一本化は評議会 20261028-234023-field-type-single-interpretation で検討中）
// 実行: pnpm test:form-defaults

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { normalizeDomainJsonConfig } from "@/lib/domain/config/normalizeDomainJsonConfig";
import sampleDomainConfig from "@/features/sample/domain.json";
import couponDomainConfig from "@/features/core/coupon/domain.json";
import { SampleCreateSchema } from "@/features/sample/entities/schema";
import { CouponCreateSchema } from "@/features/core/coupon/entities/schema";

import type { FieldDataType, FieldDataTypeFirestore } from "@/components/Form/Field/types";
import { isCheckGroupFieldType } from "@/components/Form/Field/Configured/checkGroupFieldTypes";
import { FIELD_TYPES } from "../../../../scripts/domain-config/spec/fieldTypes.mjs";
import { FORM_INPUTS } from "../../../../scripts/domain-config/spec/formInputs.mjs";

import { buildFormDefaultValues } from "./defaultValueBuilder";

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

describe("作成フォームの既定値が schema を通る", () => {
  test("sample: ギャラリー（mediaUploaderMulti）が空でも通る", () => {
    const values = buildFormDefaultValues(normalizeDomainJsonConfig(sampleDomainConfig));
    const result = SampleCreateSchema.safeParse({ ...values, name: "テスト" });
    assert.equal(result.success, true, JSON.stringify(result.error?.issues));
    assert.deepEqual(result.data?.gallery_images, []);
  });

  test("coupon: カテゴリ未選択でも settings（jsonb）が {} として通る", () => {
    const values = buildFormDefaultValues(couponDomainConfig);
    const result = CouponCreateSchema.safeParse({
      ...values,
      code: "TEST",
      type: "official",
      status: "active",
      name: "テスト",
      current_total_uses: 0,
    });
    const settingsIssues = result.error?.issues.filter((issue) => issue.path[0] === "settings") ?? [];
    assert.deepEqual(settingsIssues, []);
    if (result.success) assert.deepEqual(result.data.settings, {});
  });
});

// ---- 生成器の型の表（scripts/domain-config/spec）との突き合わせ ----

type FieldTypeSpec = { ts?: string; array?: boolean };
const FIELD_TYPE_SPECS = FIELD_TYPES as Record<string, FieldTypeSpec>;
const ENGINES = Object.keys(FORM_INPUTS) as Array<keyof typeof FORM_INPUTS>;

// 型の名前: dc:init / dc:add の選択肢に出る型が、フォーム側の union にすべてある（無ければ typecheck が落ちる）
type MissingNeon = Exclude<keyof (typeof FORM_INPUTS)["Neon"], FieldDataType>;
type MissingFirestore = Exclude<keyof (typeof FORM_INPUTS)["Firestore"], FieldDataTypeFirestore>;
const neonCovered: [MissingNeon] extends [never] ? true : MissingNeon = true;
const firestoreCovered: [MissingFirestore] extends [never] ? true : MissingFirestore = true;

describe("フォーム側の型の手書きが生成器の型の表とずれていない", () => {
  test("型の名前の union が dc の選択肢の型をすべて含む（typecheck で検査）", () => {
    assert.equal(neonCovered, true);
    assert.equal(firestoreCovered, true);
  });

  for (const engine of ENGINES) {
    for (const fieldType of Object.keys(FORM_INPUTS[engine])) {
      const arrayValued = FIELD_TYPE_SPECS[fieldType]?.ts === "string[]";

      test(`${engine} / ${fieldType}: 作成フォームの既定値は、値が配列の型なら []、それ以外は配列でない`, () => {
        const value = buildFormDefaultValues({ fields: [{ name: "x", fieldType }] }).x;
        if (arrayValued) assert.deepEqual(value, []);
        else assert.equal(Array.isArray(value), false);
      });

      const inputs: readonly string[] = (FORM_INPUTS[engine] as Record<string, readonly string[]>)[fieldType];
      if (inputs.includes("checkbox")) {
        test(`${engine} / ${fieldType}: checkbox は表の array の型だけ複数選択にする`, () => {
          assert.equal(isCheckGroupFieldType(fieldType), Boolean(FIELD_TYPE_SPECS[fieldType]?.array));
        });
      }
    }
  }
});
