// scripts/role-config/generator/generateProfileFieldTypes.mjs
// generated/{roleId}/fieldTypes.ts の生成

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

/**
 * generated/{roleId}/fieldTypes.ts を生成
 */
export function generateProfileFieldTypes(roleConfig, profileConfig) {
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
      optionTypeName: `${rolePascal}Profile${pascalField}Option`,
      valueTypeName: `${rolePascal}Profile${pascalField}Value`,
      labelTypeName: `${rolePascal}Profile${pascalField}Label`,
    };
  });

  const blocks = fieldMeta.map((field) => {
    const optionType = `export type ${field.optionTypeName} = FieldConstants["${field.constantName}"][number];`;
    const valueType = `export type ${field.valueTypeName} = ${field.optionTypeName}["value"];`;
    const labelType = `export type ${field.labelTypeName} = ${field.optionTypeName}["label"];`;
    return [optionType, valueType, labelType].join("\n");
  });

  const content = `// src/features/core/userProfile/generated/${roleId}/fieldTypes.ts
// ${roleConfig.label}プロフィールのフィールド型定義
//
// 元情報: src/features/core/userProfile/profiles/${roleId}.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

type FieldConstants = typeof import("./fieldConstants");

${blocks.join("\n\n")}
`;

  const roleDir = path.join(GENERATED_DIR, roleId);
  if (!fs.existsSync(roleDir)) {
    fs.mkdirSync(roleDir, { recursive: true });
  }

  const filePath = path.join(roleDir, "fieldTypes.ts");
  fs.writeFileSync(filePath, content);
  return true;
}
