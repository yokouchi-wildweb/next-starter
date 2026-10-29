// 検査: 項目（型と入力欄の組・選択肢・既定値）。
// 型と入力欄の組は spec/formInputs.mjs の表、既定値を持てるか・値の形は型の表（src/lib/domain/fields/fieldTypes.mjs）が正。
// 生成器は合わない組・空の選択肢（z.enum([]) と空の pgEnum）・既定値を持てない型の .default(...) を黙って書くので、生成前に止める。
// 表に無い型は扱わない（今の扱い = 語彙の警告だけ。checks/vocabulary.mjs）。
// 型と入力欄の組の外れ・入力欄（select など）の選択肢の無さは、実行時に別の場所から補う使い方があるので警告だけ（fieldsWarnings）

import { toCamelCase } from "../../../src/utils/stringCase.mjs";
import {
  allowsDefaultValue,
  isArrayFieldType,
  isEnumFieldType,
  isNumericFieldType,
  isTextFieldType,
  tsType,
} from "../spec/fieldTypes.mjs";
import { FORM_INPUTS } from "../spec/formInputs.mjs";

/** 選択肢（options）が要る入力欄。checkbox は値が配列の型のときだけ */
const CHOICE_INPUTS = new Set(["select", "radio", "multiSelect"]);

/** その DB・型で選べる入力欄（camelCase）。表に無い型は undefined */
function allowedInputs(dbEngine, fieldType) {
  const inputs = FORM_INPUTS[dbEngine]?.[fieldType];
  return Array.isArray(inputs) ? new Set(inputs.map((input) => toCamelCase(input))) : undefined;
}

/** 選択肢が要る入力欄か（select・radio・multiSelect、値が配列の型の checkbox） */
const inputNeedsOptions = (field) =>
  CHOICE_INPUTS.has(field.formInput) || (field.formInput === "checkbox" && isArrayFieldType(field.fieldType));

/** 値が型に合うか（数値の型は数値、boolean は真偽、文字列の型・enum は文字列） */
function valueMatchesType(fieldType, value) {
  if (isNumericFieldType(fieldType)) return typeof value === "number";
  if (tsType(fieldType) === "boolean") return typeof value === "boolean";
  if (isTextFieldType(fieldType) || isEnumFieldType(fieldType)) return typeof value === "string";
  return true;
}

const describeType = (fieldType) =>
  isNumericFieldType(fieldType) ? "数値" : tsType(fieldType) === "boolean" ? "true か false" : "文字列";

function fieldIssues(config, field) {
  const issues = [];
  const where = `fields "${field.name}"`;
  const inputs = allowedInputs(config.dbEngine, field.fieldType);
  const options = field.options;
  if (isEnumFieldType(field.fieldType) && (!Array.isArray(options) || options.length === 0)) {
    issues.push(`${where}: enum には options（選択肢）を 1 つ以上書いてください（空だと z.enum([]) と空の pgEnum になります）`);
  }
  if (Array.isArray(options)) {
    options.forEach((option, index) => {
      if (option === null || typeof option !== "object" || !("value" in option)) {
        issues.push(`${where}: options[${index}] は { value, label } で書いてください`);
      } else if ((isNumericFieldType(field.fieldType) || isEnumFieldType(field.fieldType)) && !valueMatchesType(field.fieldType, option.value)) {
        issues.push(`${where}: options[${index}].value の型が合いません（${describeType(field.fieldType)}で書く。今: ${JSON.stringify(option.value)}）`);
      }
    });
  }

  if (field.defaultValue !== undefined) {
    if (inputs && !allowsDefaultValue(field.fieldType)) {
      issues.push(`${where}: fieldType "${field.fieldType}" は defaultValue を持てません（消してください）`);
    } else if (isEnumFieldType(field.fieldType) && Array.isArray(options)) {
      if (!options.some((option) => option?.value === field.defaultValue)) {
        issues.push(`${where}: defaultValue ${JSON.stringify(field.defaultValue)} は options の value のどれかにしてください`);
      }
    } else if (inputs && !valueMatchesType(field.fieldType, field.defaultValue)) {
      issues.push(`${where}: defaultValue の型が合いません（${describeType(field.fieldType)}で書く。今: ${JSON.stringify(field.defaultValue)}）`);
    }
  }
  return issues;
}

/**
 * @param {object} config domain.json
 * @returns {string[]} 問題（空なら無し）
 */
export function fieldsIssues(config) {
  return (config.fields ?? []).filter((field) => typeof field?.name === "string").flatMap((field) => fieldIssues(config, field));
}

/**
 * 止めない警告: 型と入力欄の組が dc の表（spec/formInputs.mjs）に無い、選択肢が要る入力欄に options が無い
 * @param {object} config domain.json
 * @returns {string[]}
 */
export function fieldsWarnings(config) {
  const warnings = [];
  for (const field of config.fields ?? []) {
    if (typeof field?.name !== "string") continue;
    const where = `fields "${field.name}"`;
    const inputs = allowedInputs(config.dbEngine, field.fieldType);
    if (inputs && field.formInput !== undefined && !inputs.has(field.formInput)) {
      warnings.push(`${where}: fieldType "${field.fieldType}" に formInput "${field.formInput}" は表（spec/formInputs.mjs）に無い組です（${[...inputs].join(" / ")}）`);
    }
    if (!isEnumFieldType(field.fieldType) && inputNeedsOptions(field) && (!Array.isArray(field.options) || field.options.length === 0)) {
      warnings.push(`${where}: formInput "${field.formInput}" に options（選択肢）がありません（実行時に別の場所から渡していなければ選べません）`);
    }
  }
  return warnings;
}
