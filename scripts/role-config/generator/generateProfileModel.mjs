// scripts/role-config/generator/generateProfileModel.mjs
// generated/{roleId}/model.ts の生成

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

function mapTsType(t) {
  switch (t) {
    case "string":
    case "email":
    case "password":
    case "uuid":
    case "date":
    case "time":
    case "mediaUploader":
      return "string";
    case "integer":
    case "number":
    case "bigint":
    case "float":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return "string[]";
    case "timestamp":
    case "timestamp With Time Zone":
      return "Date";
    default:
      return "any";
  }
}

function addField(lines, name, type, required) {
  if (type.endsWith("[]")) {
    lines.push(`  ${name}: ${type};`);
    return;
  }

  const t = required ? type : `${type} | null`;
  lines.push(`  ${name}: ${t};`);
}

/**
 * generated/{roleId}/model.ts を生成
 */
export function generateProfileModel(roleConfig, profileConfig) {
  const roleId = roleConfig.id;
  const rolePascal = toPascalCase(roleId);

  const lines = [];

  // システムフィールド
  lines.push("  /** 主キー */");
  lines.push("  id: string;");
  lines.push("  /** ユーザーID */");
  lines.push("  userId: string;");

  // プロフィールフィールド
  (profileConfig.fields || []).forEach((f) => {
    const camelName = toCamelCase(f.name);
    if (f.fieldType === "enum") {
      const values = (f.options || []).map((o) => `"${o.value}"`).join(" | ");
      addField(lines, camelName, values, f.required);
    } else {
      const t = mapTsType(f.fieldType);
      addField(lines, camelName, t, f.required);
    }
  });

  // タイムスタンプ
  lines.push("  /** 作成日時 */");
  lines.push("  createdAt: Date | null;");
  lines.push("  /** 更新日時 */");
  lines.push("  updatedAt: Date | null;");

  const content = `// src/features/core/userProfile/generated/${roleId}/model.ts
// ${roleConfig.label}プロフィールのモデル型定義
//
// 元情報: src/features/core/userProfile/profiles/${roleId}.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

/**
 * ${roleConfig.label}プロフィールモデル
 */
export type ${rolePascal}ProfileModel = {
${lines.join("\n")}
};
`;

  const roleDir = path.join(GENERATED_DIR, roleId);
  if (!fs.existsSync(roleDir)) {
    fs.mkdirSync(roleDir, { recursive: true });
  }

  const filePath = path.join(roleDir, "model.ts");
  fs.writeFileSync(filePath, content);
}
