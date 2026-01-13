// scripts/role-config/generator/generateProfileEntity.mjs
// entities/{role}Profile.ts の生成

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { toCamelCase, toPascalCase, toSnakeCase } from "../../../src/utils/stringCase.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const ENTITIES_DIR = path.join(
  ROOT_DIR,
  "src/features/core/userProfile/entities"
);

/**
 * fieldType から Drizzle のカラム型を生成
 */
function getDrizzleColumnType(field) {
  const { name, fieldType, required } = field;
  const columnName = toSnakeCase(name);
  const camelName = toCamelCase(name);

  let columnDef = "";

  switch (fieldType) {
    case "string":
      columnDef = `text("${columnName}")`;
      break;
    case "integer":
      columnDef = `integer("${columnName}")`;
      break;
    case "boolean":
      columnDef = `boolean("${columnName}")`;
      if (required) {
        columnDef += `.default(false).notNull()`;
      }
      break;
    case "enum":
      // enum は text として保存（または pgEnum を使用）
      columnDef = `text("${columnName}")`;
      break;
    case "timestamp With Time Zone":
      columnDef = `timestamp("${columnName}", { withTimezone: true })`;
      break;
    case "array":
      // array は jsonb として保存
      columnDef = `jsonb("${columnName}").$type<string[]>().default([])`;
      break;
    default:
      columnDef = `text("${columnName}")`;
  }

  return { camelName, columnDef };
}

/**
 * フィールド定義を生成
 */
function generateFieldDefinitions(fields) {
  const lines = [];
  const imports = new Set(["uuid", "timestamp"]);

  for (const field of fields) {
    const { camelName, columnDef } = getDrizzleColumnType(field);

    // 必要な import を収集
    if (columnDef.includes("text(")) imports.add("text");
    if (columnDef.includes("integer(")) imports.add("integer");
    if (columnDef.includes("boolean(")) imports.add("boolean");
    if (columnDef.includes("jsonb(")) imports.add("jsonb");
    if (columnDef.includes("varchar(")) imports.add("varchar");

    // フィールド定義を追加
    lines.push(`  /** ${field.label} */`);
    lines.push(`  ${camelName}: ${columnDef},`);
  }

  return { lines, imports: Array.from(imports) };
}

/**
 * entities/{role}Profile.ts を生成
 */
export function generateProfileEntity(roleConfig, profileConfig) {
  const roleId = roleConfig.id;
  const rolePascal = toPascalCase(roleId);
  const tableVar = `${rolePascal}ProfileTable`;
  const tableName = `${toSnakeCase(roleId)}_profiles`;

  const { lines: fieldLines, imports } = generateFieldDefinitions(profileConfig.fields);

  const content = `// src/features/core/userProfile/entities/${toCamelCase(roleId)}Profile.ts
// ${roleConfig.label}（${roleId}）ロール用のプロフィールテーブル
//
// 元情報: src/features/core/userProfile/profiles/${roleId}.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

import { UserTable } from "@/features/core/user/entities/drizzle";
import { ${imports.join(", ")}, pgTable } from "drizzle-orm/pg-core";

/**
 * ${roleConfig.label}プロフィールテーブル
 *
 * @source ${roleId}.profile.json
 */
export const ${tableVar} = pgTable("${tableName}", {
  // ==========================================================================
  // システムフィールド（全プロフィールテーブル共通）
  // ==========================================================================
  /** 主キー */
  id: uuid("id").primaryKey().defaultRandom(),
  /** UserTable.id への外部キー（1:1、unique制約で担保） */
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => UserTable.id, { onDelete: "cascade" }),

  // ==========================================================================
  // プロフィールフィールド
  // @source ${roleId}.profile.json
  // ==========================================================================
${fieldLines.join("\n")}

  // ==========================================================================
  // タイムスタンプ（全プロフィールテーブル共通）
  // ==========================================================================
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * ${roleConfig.label}プロフィールの型
 */
export type ${rolePascal}Profile = typeof ${tableVar}.$inferSelect;
export type ${rolePascal}ProfileInsert = typeof ${tableVar}.$inferInsert;
`;

  const filePath = path.join(ENTITIES_DIR, `${toCamelCase(roleId)}Profile.ts`);
  fs.writeFileSync(filePath, content);
}
