// scripts/role-config/generator/generateProfileFieldConstants.mjs
// generated/{roleId}/fieldConstants.ts の生成

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

function formatOption(option, indent = 2) {
  const pad = " ".repeat(indent);
  const value = JSON.stringify(option.value);
  const label = JSON.stringify(option.label);
  return `${pad}{ value: ${value}, label: ${label} }`;
}

function formatOptions(options) {
  const body = options.map((option) => formatOption(option)).join(",\n");
  return ["[", body, "] as const"].join("\n");
}

/**
 * generated/{roleId}/fieldConstants.ts を生成
 */
export function generateProfileFieldConstants(roleConfig, profileConfig) {
  const roleId = roleConfig.id;
  const rolePascal = toPascalCase(roleId);

  // options を持つフィールドのみ抽出
  const optionFields = (profileConfig.fields || []).filter(
    (field) => Array.isArray(field.options) && field.options.length > 0
  );

  // options を持つフィールドがなければスキップ
  if (optionFields.length === 0) {
    return false;
  }

  const fieldMeta = optionFields.map((field) => {
    const pascalField = toPascalCase(field.name);
    return {
      name: field.name,
      constantName: `${rolePascal}Profile${pascalField}Options`,
      options: field.options.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    };
  });

  const blocks = fieldMeta.map((field) => {
    const optionsLiteral = formatOptions(field.options);
    return `export const ${field.constantName} = ${optionsLiteral};`;
  });

  const content = `// src/features/core/userProfile/generated/${roleId}/fieldConstants.ts
// ${roleConfig.label}プロフィールのフィールド定数
//
// 元情報: src/features/core/userProfile/profiles/${roleId}.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

${blocks.join("\n\n")}
`;

  const roleDir = path.join(GENERATED_DIR, roleId);
  if (!fs.existsSync(roleDir)) {
    fs.mkdirSync(roleDir, { recursive: true });
  }

  const filePath = path.join(roleDir, "fieldConstants.ts");
  fs.writeFileSync(filePath, content);
  return true;
}
