// eslint-rules/field-type-guard.mjs
//
// 型の表（src/lib/domain/fields/fieldTypes.mjs）の外で、domain.json の fieldType の名前を決め打ちするコードを検出する（番人）。
// 規約（CLAUDE.md DOMAINS field_types）: 型の意味は表だけが決める。初期値・列・Zod・表示などの答えは
// fieldTypeSpec と表の導出関数で引き、表の外に型名の比較や型名の集合を書かない（ずれのバグはそこからしか生まれない）。
//
// 検出するもの:
//   (a) fieldType 由来の値と文字列の比較: `x.fieldType === "enum"`、名前に fieldType を含む変数、
//       `.fieldType` から代入した変数（`const t = field.fieldType?.toLowerCase()` 等）の ===・!==・switch の case・
//       includes / startsWith / endsWith
//   (b) 型名の集合: 表のキーのうち一般語でないもの（stringArray・bigint・"numeric(10,2)" 等）を
//       2 つ以上含む配列リテラル（Set の初期値を含む）・switch の case 列。変数名が fieldType でなくても拾う
// 通すもの: typeof の比較、一般語だけの集合、入力種別（formInput）の名前の集合、表そのもの（src/lib/domain/fields/ は eslint.config.mjs の対象外）
//
// 正当な例外は理由付き eslint-disable で明示する（フォルダ単位の許可リストは無い）。対象範囲と強さ（上流リポ = error、fork = warn）は
// eslint.config.mjs 側で決める。

import { FIELD_TYPES } from "../src/lib/domain/fields/fieldTypes.mjs";
import { FORM_INPUT_VALUES } from "../scripts/structure/domain/spec/domainJson.mjs";

/** 表のキーのうち、型以外の意味でもよく書かれる語（集合の数に入れない） */
const GENERAL_WORDS = new Set([
  "string",
  "number",
  "boolean",
  "date",
  "time",
  "email",
  "password",
  "uuid",
  "enum",
  "array",
  "null",
  "map",
  "reference",
  "timestamp",
  "integer",
  "float",
]);

/** 2 つ以上含めば型名の集合とみなすキー（表から導くので、表に行を足せば自動で増える） */
export const DISTINCTIVE_FIELD_TYPES = new Set(Object.keys(FIELD_TYPES).filter((key) => !GENERAL_WORDS.has(key)));

const COMPARE_OPERATORS = new Set(["===", "!==", "==", "!="]);
const COMPARE_METHODS = new Set(["includes", "startsWith", "endsWith"]);
const FIELD_TYPE_NAME = /fieldType/i;

/** 文字列リテラルの値（それ以外は undefined） */
function stringValue(node) {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value;
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return undefined;
}

/**
 * 文字列の並びに、一般語でない表のキーがいくつ含まれるか（重複は 1 つ）。
 * 入力種別（formInput）の名前でもあるキー（mediaUploader・mediaUploaderMulti）は数えない: 入力種別の集合を型の集合と取り違えるため
 */
export function countDistinctiveFieldTypes(values) {
  return new Set(values.filter((v) => typeof v === "string" && DISTINCTIVE_FIELD_TYPES.has(v) && !FORM_INPUT_VALUES.has(v))).size;
}

function propertyName(member) {
  if (member.computed) return stringValue(member.property);
  return member.property.type === "Identifier" ? member.property.name : undefined;
}

/**
 * 式が fieldType 由来か
 * @param {any} node
 * @param {Set<string>} tracked `.fieldType` から代入した変数名
 */
export function isFieldTypeExpression(node, tracked) {
  if (!node) return false;
  switch (node.type) {
    case "ChainExpression":
    case "TSNonNullExpression":
    case "TSAsExpression":
      return isFieldTypeExpression(node.expression, tracked);
    case "Identifier":
      return FIELD_TYPE_NAME.test(node.name) || tracked.has(node.name);
    case "MemberExpression":
      return propertyName(node) === "fieldType";
    case "CallExpression":
      // fieldType.toLowerCase() / fieldType?.trim() など、fieldType の上の呼び出し（比べるメソッドは別に見る）
      return (
        node.callee.type === "MemberExpression" &&
        !COMPARE_METHODS.has(propertyName(node.callee)) &&
        isFieldTypeExpression(node.callee.object, tracked)
      );
    case "LogicalExpression":
      // fieldType ?? "" / fieldType || ""
      return isFieldTypeExpression(node.left, tracked);
    default:
      return false;
  }
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "型の表（src/lib/domain/fields/fieldTypes.mjs）の外で fieldType の名前を比べない",
    },
    messages: {
      compare:
        'fieldType を "{{value}}" と比べています。型の答えは型の表（src/lib/domain/fields/fieldTypes.mjs）の属性と導出関数で引いてください（正当な例外は理由付き eslint-disable）',
      collection:
        "型名の集合（{{values}}）を表の外に書いています。型の表（src/lib/domain/fields/fieldTypes.mjs）の属性で判定してください（正当な例外は理由付き eslint-disable）",
    },
    schema: [],
  },
  create(context) {
    const tracked = new Set();
    const reportCollection = (node, values) => {
      const hits = [...new Set(values.filter((v) => DISTINCTIVE_FIELD_TYPES.has(v)))];
      context.report({ node, messageId: "collection", data: { values: hits.join(", ") } });
    };
    return {
      VariableDeclarator(node) {
        if (node.id.type === "Identifier" && isFieldTypeExpression(node.init, tracked)) tracked.add(node.id.name);
      },
      AssignmentExpression(node) {
        if (node.left.type === "Identifier" && isFieldTypeExpression(node.right, tracked)) tracked.add(node.left.name);
      },
      BinaryExpression(node) {
        if (!COMPARE_OPERATORS.has(node.operator)) return;
        for (const [side, other] of [
          [node.left, node.right],
          [node.right, node.left],
        ]) {
          const value = stringValue(side);
          if (value !== undefined && isFieldTypeExpression(other, tracked)) {
            context.report({ node, messageId: "compare", data: { value } });
            return;
          }
        }
      },
      CallExpression(node) {
        if (node.callee.type !== "MemberExpression" || !COMPARE_METHODS.has(propertyName(node.callee))) return;
        const value = stringValue(node.arguments[0]);
        if (value !== undefined && isFieldTypeExpression(node.callee.object, tracked)) {
          context.report({ node, messageId: "compare", data: { value } });
        }
      },
      SwitchStatement(node) {
        const values = node.cases.map((c) => stringValue(c.test)).filter((v) => v !== undefined);
        if (values.length > 0 && isFieldTypeExpression(node.discriminant, tracked)) {
          context.report({ node: node.discriminant, messageId: "compare", data: { value: values.join(" / ") } });
          return;
        }
        if (countDistinctiveFieldTypes(values) >= 2) reportCollection(node.discriminant, values);
      },
      ArrayExpression(node) {
        const values = node.elements.map((e) => stringValue(e)).filter((v) => v !== undefined);
        if (countDistinctiveFieldTypes(values) >= 2) reportCollection(node, values);
      },
    };
  },
};

const plugin = {
  meta: {
    name: "eslint-plugin-local-field-type-guard",
    version: "1.0.0",
  },
  rules: {
    "no-literal-field-type": rule,
  },
};

export default plugin;
