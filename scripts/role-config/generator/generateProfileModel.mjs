// scripts/role-config/generator/generateProfileModel.mjs
// entities/profiles/{roleId}/model.ts の生成

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { toCamelCase, toPascalCase } from "../../../src/utils/stringCase.mjs";
import { isEnumFieldType, tsType } from "../../../src/lib/domain/fields/fieldTypes.mjs";
import { profileFileHeader } from "./header.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const GENERATED_DIR = path.join(
  ROOT_DIR,
  "src/features/core/userProfile/entities/profiles"
);

// 型 → TS の型は型の表（src/lib/domain/fields/fieldTypes.mjs）
const mapTsType = (fieldType) => tsType(fieldType);

function addField(lines, name, type, required) {
  if (type.endsWith("[]")) {
    lines.push(`  ${name}: ${type};`);
    return;
  }

  const t = required ? type : `${type} | null`;
  lines.push(`  ${name}: ${t};`);
}

/**
 * entities/profiles/{roleId}/model.ts を生成
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

  // belongsTo リレーションの FK フィールド
  (profileConfig.relations || []).forEach((rel) => {
    if (rel.relationType !== "belongsTo") return;
    const camelName = toCamelCase(rel.fieldName);
    addField(lines, camelName, "string", rel.required);
  });

  // プロフィールフィールド
  (profileConfig.fields || []).forEach((f) => {
    const camelName = toCamelCase(f.name);
    if (isEnumFieldType(f.fieldType)) {
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

  const content = `${profileFileHeader(roleId)}
// src/features/core/userProfile/entities/profiles/${roleId}/model.ts
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
