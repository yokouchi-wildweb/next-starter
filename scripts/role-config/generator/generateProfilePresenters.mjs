// scripts/role-config/generator/generateProfilePresenters.mjs
// generated/{roleId}/presenters.ts の生成

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { toCamelCase, toPascalCase } from "../../../src/utils/stringCase.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const GENERATED_DIR = path.join(
  ROOT_DIR,
  "src/features/core/userProfile/generated"
);

const buildOptionsMap = (options = []) => {
  return options
    .map((opt) => `"${String(opt.value)}": "${opt.label ?? opt.value}"`)
    .join(", ");
};

const buildFormatter = (field) => {
  const { fieldType, formInput, options } = field;
  switch (fieldType) {
    case "boolean":
      return `formatBoolean(value, "はい", "いいえ")`;
    case "integer":
    case "number":
    case "float":
      return `formatNumber(value)`;
    case "array":
      return `formatStringArray(value)`;
    case "enum":
      if (Array.isArray(options) && options.length) {
        return `formatEnumLabel(value, { ${buildOptionsMap(options)} })`;
      }
      return `formatString(value)`;
    default:
      break;
  }

  if (formInput === "numberInput" || formInput === "stepperInput") {
    return `formatNumber(value)`;
  }
  if (formInput === "textarea" || formInput === "textInput") {
    return `formatString(value)`;
  }
  if (formInput === "datetimeInput") {
    return `formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null }))`;
  }
  if (formInput === "dateInput") {
    return `formatDateValue(value, "YYYY/MM/DD", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null }))`;
  }
  if (formInput === "mediaUploader" || formInput === "fileUploader") {
    return null;
  }

  return `formatString(value)`;
};

/**
 * generated/{roleId}/presenters.ts を生成
 */
export function generateProfilePresenters(roleConfig, profileConfig) {
  const roleId = roleConfig.id;
  const rolePascal = toPascalCase(roleId);

  const presenterEntries = (profileConfig.fields ?? [])
    .map((field) => {
      const formatter = buildFormatter(field);
      if (formatter === null) {
        return null;
      }
      const camelName = toCamelCase(field.name);
      return `  ${camelName}: ({ value }: { value: unknown }) => ${formatter},`;
    })
    .filter((entry) => entry !== null);

  const body = presenterEntries.length
    ? presenterEntries.join("\n")
    : "  // フィールドなし";

  const content = `// src/features/core/userProfile/generated/${roleId}/presenters.ts
// ${roleConfig.label}プロフィールのプレゼンター
//
// 元情報: src/features/core/userProfile/profiles/${roleId}.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

import {
  formatBoolean,
  formatDateValue,
  formatEnumLabel,
  formatNumber,
  formatString,
  formatStringArray,
} from "@/lib/crud/presenters";
import { formatDateJa } from "@/utils/date";

/**
 * ${roleConfig.label}プロフィールのプレゼンター
 */
export const ${toCamelCase(roleId)}ProfilePresenters = {
${body}
};
`;

  const roleDir = path.join(GENERATED_DIR, roleId);
  if (!fs.existsSync(roleDir)) {
    fs.mkdirSync(roleDir, { recursive: true });
  }

  const filePath = path.join(roleDir, "presenters.ts");
  fs.writeFileSync(filePath, content);
}
