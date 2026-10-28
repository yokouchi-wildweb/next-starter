// dc:init / dc:add のフィールド定義の質問。1 項目 = 名前 → 表示名 → 型 → 入力種別 → （メディアの追加質問）→ 必須 → 選択肢 → デフォルト値
// 型が主の集まり（mediaCollection）なら collection.mjs の問いに切り替える

import inquirer from "inquirer";
import { fieldTypeChoices } from "../../spec/collectionField.mjs";
import { isArrayFieldType, isCollectionFieldType } from "../../spec/fieldTypes.mjs";
import { FORM_INPUTS } from "../../spec/formInputs.mjs";
import { toCamelCase, toSnakeCase } from "../../../../src/utils/stringCase.mjs";
import { askCollectionField } from "./collection.mjs";
import { askMediaDetails } from "./media.mjs";
import { askFieldOptions } from "./options.mjs";
import { askDefaultValue } from "./defaultValue.mjs";

const prompt = inquirer.createPromptModule();

const READONLY_SUPPORTED_FORM_INPUTS = new Set(["textInput", "numberInput", "textarea"]);

/** 質問の答えから domain.json の 1 項目を組む（値が無いキーは書かない） */
function buildField({ trimmedName, trimmedLabel, fieldType, normalizedInput, required, media, options, defaultValue }) {
  const { slug, mediaTypePreset, acceptValue, maxSizeBytes, metadataBinding } = media;
  const field = {
    name: trimmedName,
    label: trimmedLabel,
    fieldType,
    formInput: normalizedInput,
    ...(READONLY_SUPPORTED_FORM_INPUTS.has(normalizedInput) ? { readonly: false } : {}),
    required,
    ...(slug ? { slug } : {}),
    ...(mediaTypePreset ? { mediaTypePreset } : {}),
    ...(acceptValue ? { accept: acceptValue } : {}),
    ...(typeof maxSizeBytes === "number" ? { validationRule: { maxSizeBytes } } : {}),
    ...(metadataBinding ? { metadataBinding } : {}),
    ...(options && options.length ? { options } : {}),
    ...(defaultValue !== undefined ? { defaultValue } : {}),
  };
  const isArrayField = isArrayFieldType(fieldType);
  if (normalizedInput === "radio" || (normalizedInput === "checkbox" && isArrayField)) {
    field.displayType = "standard";
  }
  return field;
}

async function askSingleField(config) {
  const { name } = await prompt({
    type: "input",
    name: "name",
    message: config._fieldIndex === 0 ? "フィールド名（snake_case。空でスキップ）:" : "フィールド名（snake_case。空で終了）:",
  });
  if (!name.trim()) return null;

  const { label } = await prompt({ type: "input", name: "label", message: "フィールド表示名:" });

  const trimmedName = toSnakeCase(name.trim());
  const trimmedLabel = label.trim() || trimmedName;

  const { fieldType } = await prompt({
    type: "list",
    name: "fieldType",
    message: "フィールドの型を選択:",
    choices: fieldTypeChoices(config.dbEngine),
  });
  if (isCollectionFieldType(fieldType)) return askCollectionField(config, trimmedName, trimmedLabel);

  const { formInput } = await prompt({
    type: "list",
    name: "formInput",
    message: "フォーム入力種別を選択:",
    choices: FORM_INPUTS[config.dbEngine][fieldType],
  });
  const normalizedInput = toCamelCase(formInput);

  const isArrayField = isArrayFieldType(fieldType);
  const isMediaField = normalizedInput === "mediaUploader";
  const media = isMediaField ? await askMediaDetails(trimmedName) : {};

  let required = false;
  if (isArrayField) {
    console.log("配列フィールドは未選択時に空配列を保存するため、必須設定はスキップします。");
  } else {
    ({ required } = await prompt({
      type: "confirm",
      name: "required",
      message: "このフィールドを必須にしますか?",
      default: false,
    }));
  }

  const options = await askFieldOptions({ fieldType, normalizedInput });

  // デフォルト値の質問（mediaUploader は対象外）
  const defaultValue = isMediaField ? undefined : await askDefaultValue(fieldType, options);

  const field = buildField({ trimmedName, trimmedLabel, fieldType, normalizedInput, required, media, options, defaultValue });
  console.log("\nフィールドを追加しました:", field, "\n");
  return field;
}

/** 空の名前が入るまでフィールドを聞き続ける。config._fieldIndex は質問文の切り替えに使い、終わったら消す */
export default async function askFields(config) {
  const fields = [];
  config._fieldIndex = 0;
  while (true) {
    const field = await askSingleField(config);
    if (!field) break;
    fields.push(field);
    config._fieldIndex += 1;
  }
  delete config._fieldIndex;
  return { fields };
}
