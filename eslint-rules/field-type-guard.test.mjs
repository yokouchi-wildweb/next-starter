// eslint-rules/field-type-guard.test.mjs
// 型の表の外での fieldType 名の決め打ち検出（番人）の契約テスト。実行: pnpm test:field-type-guard (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { RuleTester } from "eslint";

import plugin, { countDistinctiveFieldTypes, DISTINCTIVE_FIELD_TYPES } from "./field-type-guard.mjs";

// TS の構文（as・!・型注釈）を解析するため TS パーサーを使う。直接依存にはしていないので eslint-config-next 経由で解決する
const tsParser = createRequire(import.meta.resolve("eslint-config-next"))("@typescript-eslint/parser");

test("countDistinctiveFieldTypes: 一般語と入力種別の名前は数えず、表のキーから導く", () => {
  assert.equal(countDistinctiveFieldTypes(["bigint", "numeric(10,2)"]), 2);
  assert.equal(countDistinctiveFieldTypes(["stringArray", "jsonb", "stringArray"]), 2);
  // 一般語（array・string・integer 等）は数えない
  assert.equal(countDistinctiveFieldTypes(["array", "stringArray"]), 1);
  assert.equal(countDistinctiveFieldTypes(["string", "integer", "boolean"]), 0);
  // mediaUploader / mediaUploaderMulti は入力種別の名前でもあるので数えない
  assert.equal(countDistinctiveFieldTypes(["mediaUploader", "mediaUploaderMulti", "fileUploader"]), 0);
  // 表に行を足せば集合の検出も増える（表から導く）
  assert.ok(DISTINCTIVE_FIELD_TYPES.has("timestamp With Time Zone"));
  assert.ok(!DISTINCTIVE_FIELD_TYPES.has("string"));
});

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module", parser: tsParser },
});

test("rule: fieldType 由来の値と文字列の比較・型名の集合を検出し、typeof・無関係な比較・入力種別の集合は通す", () => {
  ruleTester.run("no-literal-field-type", plugin.rules["no-literal-field-type"], {
    valid: [
      // 表の導出関数で引く
      { code: `if (isArrayFieldType(field.fieldType)) {}` },
      // typeof の比較
      { code: `if (typeof field.fieldType === "string") {}` },
      // fieldType でない値の比較（名前に type を含むだけ）
      { code: `if (message.type === "enum") {} if (node.type === "string") {}` },
      { code: `switch (event.type) { case "stringArray": break; }` },
      // fieldType 同士の比較
      { code: `if (a.fieldType === b.fieldType) {}` },
      // 一般語だけの集合・一般語でない型名が 1 つだけの集合
      { code: `const xs = ["string", "number", "boolean"]; const ys = new Set(["array", "stringArray"]);` },
      // 入力種別（formInput）の集合
      { code: `const UNSORTABLE = new Set(["mediaUploader", "mediaUploaderMulti", "fileUploader"]);` },
      { code: `switch (formInput) { case "mediaUploader": break; case "mediaUploaderMulti": break; case "textInput": break; }` },
    ],
    invalid: [
      { code: `if (field.fieldType === "enum") {}`, errors: [{ messageId: "compare" }] },
      { code: `if ("timestamp" !== config.fieldType) {}`, errors: [{ messageId: "compare" }] },
      { code: `const isDate = fieldType === "date";`, errors: [{ messageId: "compare" }] },
      { code: `if (field?.fieldType === "mediaUploader") {}`, errors: [{ messageId: "compare" }] },
      // .fieldType から代入した変数（小文字化・既定値を経ても）
      {
        code: `const normalizedType = field.fieldType?.toLowerCase() || ""; if (normalizedType === "array") {}`,
        errors: [{ messageId: "compare" }],
      },
      {
        code: `const t = f.fieldType; if (t.includes("timestamp")) {}`,
        errors: [{ messageId: "compare" }],
      },
      { code: `switch (field.fieldType) { case "jsonb": break; }`, errors: [{ messageId: "compare" }] },
      // 変数名が fieldType でなくても、型名の case 列・集合は拾う（role-config の switch (type) の形）
      {
        code: `function f(type) { switch (type) { case "bigint": return 1; case "numeric(10,2)": return 2; } }`,
        errors: [{ messageId: "collection" }],
      },
      { code: `const NUMERIC = new Set(["integer", "float", "bigint", "numeric(10,2)"]);`, errors: [{ messageId: "collection" }] },
      { code: `const xs = ["timestamp With Time Zone", "jsonb"];`, errors: [{ messageId: "collection" }] },
    ],
  });
});
