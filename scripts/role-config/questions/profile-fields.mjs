// scripts/role-config/questions/profile-fields.mjs
// プロフィールフィールドの収集

import inquirer from "inquirer";
import { toCamelCase, toSnakeCase } from "../../../src/utils/stringCase.mjs";
import { PROFILE_FORM_INPUTS, PROFILE_FIELD_TAGS } from "../form-inputs.mjs";
import chalk from "chalk";

const prompt = inquirer.createPromptModule();

const NUMERIC_FIELD_TYPES = new Set(["integer", "float", "bigint", "numeric(10,2)"]);
const DEFAULT_VALUE_EXCLUDED_TYPES = new Set(["timestamp With Time Zone", "array", "jsonb"]);
const READONLY_SUPPORTED_FORM_INPUTS = new Set(["textInput", "numberInput", "textarea"]);

/**
 * 選択肢を収集
 */
async function askOptions(parseValue) {
  const options = [];
  while (true) {
    const { value } = await prompt({
      type: "input",
      name: "value",
      message:
        options.length === 0
          ? "選択肢として保存する値（例: apple。空で終了）:"
          : "次の選択肢として保存する値（空で終了）:",
    });
    if (!value.trim()) break;

    let parsedValue = value.trim();
    if (parseValue) {
      try {
        parsedValue = parseValue(value.trim());
      } catch (error) {
        console.log(error.message || "選択肢の値が不正です。");
        continue;
      }
    }

    const { label } = await prompt({
      type: "input",
      name: "label",
      message: `値 "${parsedValue}" の表示ラベル:`,
      default: parsedValue.toString(),
    });

    options.push({ value: parsedValue, label: label.trim() || parsedValue.toString() });
  }
  return options;
}

/**
 * デフォルト値を収集
 */
async function askDefaultValue(fieldType, options) {
  // 対象外のフィールドタイプはスキップ
  if (DEFAULT_VALUE_EXCLUDED_TYPES.has(fieldType)) {
    return undefined;
  }

  const isNumericField = NUMERIC_FIELD_TYPES.has(fieldType);
  const isBooleanField = fieldType === "boolean";
  const isEnumField = fieldType === "enum";

  // enum: 選択式
  if (isEnumField && options && options.length > 0) {
    const choices = [
      { name: "(設定しない)", value: "__SKIP__" },
      ...options.map((opt) => ({ name: `${opt.label} (${opt.value})`, value: opt.value })),
    ];
    const { defaultValue } = await prompt({
      type: "list",
      name: "defaultValue",
      message: "デフォルト値を選択（設定しない場合は最初の項目）:",
      choices,
    });
    return defaultValue === "__SKIP__" ? undefined : defaultValue;
  }

  // boolean: true/false のみ許可
  if (isBooleanField) {
    const { defaultValue } = await prompt({
      type: "list",
      name: "defaultValue",
      message: "デフォルト値を選択:",
      choices: [
        { name: "(設定しない)", value: "__SKIP__" },
        { name: "true", value: true },
        { name: "false", value: false },
      ],
    });
    return defaultValue === "__SKIP__" ? undefined : defaultValue;
  }

  // 数値: Number() 変換
  if (isNumericField) {
    while (true) {
      const { defaultValue } = await prompt({
        type: "input",
        name: "defaultValue",
        message: "デフォルト値（空でスキップ）:",
      });
      const trimmed = defaultValue.trim();
      if (!trimmed) return undefined;
      const numericValue = Number(trimmed);
      if (Number.isNaN(numericValue)) {
        console.log("数値を入力してください。");
        continue;
      }
      return numericValue;
    }
  }

  // 文字列: そのまま
  const { defaultValue } = await prompt({
    type: "input",
    name: "defaultValue",
    message: "デフォルト値（空でスキップ）:",
  });
  const trimmed = defaultValue.trim();
  return trimmed || undefined;
}

/**
 * 単一フィールドの収集
 */
async function askSingleField(fieldIndex) {
  // フィールド名
  const { name } = await prompt({
    type: "input",
    name: "name",
    message:
      fieldIndex === 0
        ? "フィールド名（snake_case。空でスキップ）:"
        : "フィールド名（snake_case。空で終了）:",
  });
  if (!name.trim()) return null;

  const trimmedName = toSnakeCase(name.trim());

  // 表示ラベル
  const { label } = await prompt({
    type: "input",
    name: "label",
    message: "フィールド表示名:",
    default: trimmedName,
  });
  const trimmedLabel = label.trim() || trimmedName;

  // フィールドタイプ
  const fieldTypes = Object.keys(PROFILE_FORM_INPUTS);
  const { fieldType } = await prompt({
    type: "list",
    name: "fieldType",
    message: "フィールドの型:",
    choices: fieldTypes,
  });

  // フォーム入力種別
  const formChoices = PROFILE_FORM_INPUTS[fieldType];
  const { formInput } = await prompt({
    type: "list",
    name: "formInput",
    message: "フォーム入力種別:",
    choices: formChoices,
  });
  const normalizedInput = toCamelCase(formInput);

  // フィールドタイプ別の判定
  const isBooleanField = fieldType === "boolean";
  const isArrayField = fieldType === "array";
  const isEnumField = fieldType === "enum";
  const isNumericField = NUMERIC_FIELD_TYPES.has(fieldType);

  // 必須設定
  let required = false;
  if (!isArrayField && normalizedInput !== "hidden") {
    const { requiredAnswer } = await prompt({
      type: "confirm",
      name: "requiredAnswer",
      message: "このフィールドを必須にしますか？",
      default: false,
    });
    required = requiredAnswer;
  }

  // プレースホルダー（テキスト系のみ）
  let placeholder;
  if (["textInput", "textarea", "numberInput"].includes(normalizedInput)) {
    const { placeholderAnswer } = await prompt({
      type: "input",
      name: "placeholderAnswer",
      message: "プレースホルダー（空でスキップ）:",
    });
    if (placeholderAnswer.trim()) {
      placeholder = placeholderAnswer.trim();
    }
  }

  // readonly（テキスト系のみ）
  let readonly = false;
  if (READONLY_SUPPORTED_FORM_INPUTS.has(normalizedInput)) {
    const { readonlyAnswer } = await prompt({
      type: "confirm",
      name: "readonlyAnswer",
      message: "このフィールドを読み取り専用にしますか？",
      default: false,
    });
    readonly = readonlyAnswer;
  }

  // 選択肢（select, radio, checkbox, multiSelect, enum）
  let options;
  const needsOptions =
    isBooleanField ||
    isArrayField ||
    isEnumField ||
    normalizedInput === "radio" ||
    normalizedInput === "select" ||
    (normalizedInput === "checkbox" && !isBooleanField);

  if (needsOptions) {
    if (isBooleanField) {
      console.log("真偽値フィールドのため、選択肢は自動的に設定されます。");
      options = [
        { value: true, label: "はい" },
        { value: false, label: "いいえ" },
      ];
    } else {
      const optionValueParser = isNumericField
        ? (v) => {
            const num = Number(v);
            if (Number.isNaN(num)) throw new Error("数値を入力してください。");
            return num;
          }
        : undefined;

      console.log("選択肢を入力してください。空欄で入力終了。");
      do {
        options = await askOptions(optionValueParser);
        if (!options.length && (isArrayField || isEnumField)) {
          console.log("少なくとも1つの選択肢が必要です。");
        }
      } while (!options.length && (isArrayField || isEnumField));
    }
  }

  // デフォルト値の質問
  const defaultValue = await askDefaultValue(fieldType, options);

  // フィールドオブジェクト構築（tagsは後で別途収集）
  // Boolean型の場合: required=false → nullable: true（NULLを許容）
  // Boolean型はデフォルトで notNull なので、明示的にNULLを許容する場合のみ nullable を設定
  const field = {
    name: trimmedName,
    label: trimmedLabel,
    fieldType,
    formInput: normalizedInput,
    ...(READONLY_SUPPORTED_FORM_INPUTS.has(normalizedInput) ? { readonly } : {}),
    ...(required ? { required: true } : {}),
    ...(isBooleanField && !required ? { nullable: true } : {}),
    ...(placeholder ? { placeholder } : {}),
    ...(options && options.length ? { options } : {}),
    ...(defaultValue !== undefined ? { defaultValue } : {}),
  };

  // displayType の設定（radio/checkbox）
  const shouldAssignDisplayType =
    normalizedInput === "radio" || (normalizedInput === "checkbox" && isArrayField);
  if (shouldAssignDisplayType) {
    field.displayType = "standard";
  }

  console.log("\nフィールドを追加しました:", field, "\n");
  return field;
}

/**
 * タグごとにフィールドを選択
 * @param {Array} fields - 収集済みフィールド
 * @param {Array} relations - 収集済みリレーション（オプション）
 * @returns {Promise<Object>} タグマッピング
 */
export async function askTagMappings(fields, relations = []) {
  console.log("\n=== タグマッピングの設定 ===\n");
  console.log("各タグに紐づけるフィールドを選択してください。\n");

  // hidden以外のフィールドを選択肢として提供
  const selectableFields = fields.filter((f) => f.formInput !== "hidden");
  const hiddenFields = fields.filter((f) => f.formInput === "hidden");

  if (selectableFields.length === 0) {
    console.log("選択可能なフィールドがありません（全てhidden）。");
    // hiddenフィールドはadminタグに自動割り当て
    const tags = {};
    if (hiddenFields.length > 0) {
      tags.admin = hiddenFields.map((f) => f.name);
    }
    return tags;
  }

  const fieldChoices = selectableFields.map((f) => ({
    name: `${f.label} (${f.name})`,
    value: f.name,
  }));

  // リレーション fieldName も選択肢に追加
  const relationChoices = (relations || [])
    .filter((r) => r.formInput !== "hidden")
    .map((r) => ({
      name: `${r.label} (${r.fieldName}) [${r.relationType}]`,
      value: r.fieldName,
    }));
  const allChoices = [...fieldChoices, ...relationChoices];

  const tags = {};

  for (const tagConfig of PROFILE_FIELD_TAGS) {
    const tagValue = tagConfig.value;
    const tagLabel = tagConfig.name || tagConfig.label;

    const { selectedFields } = await prompt({
      type: "checkbox",
      name: "selectedFields",
      message: `${chalk.cyan(tagLabel)} に表示するフィールド:`,
      choices: allChoices,
    });

    tags[tagValue] = selectedFields;
  }

  // hiddenフィールドは自動的にadminタグに追加
  if (hiddenFields.length > 0) {
    const hiddenNames = hiddenFields.map((f) => f.name);
    if (tags.admin) {
      // 重複を除いて追加
      tags.admin = [...new Set([...tags.admin, ...hiddenNames])];
    } else {
      tags.admin = hiddenNames;
    }
  }

  return tags;
}

/**
 * プロフィールフィールドを収集
 * @returns {Promise<{fields: Array, tags: Object}>}
 */
export default async function askProfileFields() {
  console.log("\n=== プロフィールフィールドの設定 ===\n");

  const fields = [];
  let fieldIndex = 0;

  while (true) {
    const field = await askSingleField(fieldIndex);
    if (!field) break;
    fields.push(field);
    fieldIndex += 1;
  }

  if (fields.length === 0) {
    return { fields, tags: {} };
  }

  // タグマッピングはリレーション収集後に行うため、ここでは収集しない
  return { fields, tags: {} };
}
