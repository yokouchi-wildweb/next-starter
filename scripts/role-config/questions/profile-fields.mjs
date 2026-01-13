// scripts/role-config/questions/profile-fields.mjs
// プロフィールフィールドの収集

import inquirer from "inquirer";
import { toCamelCase, toSnakeCase } from "../../../src/utils/stringCase.mjs";
import { PROFILE_FORM_INPUTS, PROFILE_FIELD_TAGS } from "../form-inputs.mjs";
import chalk from "chalk";

const prompt = inquirer.createPromptModule();

const NUMERIC_FIELD_TYPES = new Set(["integer"]);

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

  // フィールドオブジェクト構築（tagsは後で別途収集）
  const field = {
    name: trimmedName,
    label: trimmedLabel,
    fieldType,
    formInput: normalizedInput,
    ...(required ? { required: true } : {}),
    ...(placeholder ? { placeholder } : {}),
    ...(options && options.length ? { options } : {}),
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
 * @returns {Promise<Object>} タグマッピング
 */
async function askTagMappings(fields) {
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

  const tags = {};

  for (const tagConfig of PROFILE_FIELD_TAGS) {
    const tagValue = tagConfig.value;
    const tagLabel = tagConfig.name || tagConfig.label;

    const { selectedFields } = await prompt({
      type: "checkbox",
      name: "selectedFields",
      message: `${chalk.cyan(tagLabel)} に表示するフィールド:`,
      choices: fieldChoices,
    });

    if (selectedFields.length > 0) {
      tags[tagValue] = selectedFields;
    }
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

  // タグマッピングを収集
  const tags = await askTagMappings(fields);

  return { fields, tags };
}
