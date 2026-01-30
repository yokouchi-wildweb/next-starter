// scripts/role-config/generator/generateProfileDrizzle.mjs
// generated/{roleId}/drizzle.ts の生成

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { toCamelCase, toPascalCase, toSnakeCase } from "../../../src/utils/stringCase.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const GENERATED_DIR = path.join(
  ROOT_DIR,
  "src/features/core/userProfile/generated"
);

/**
 * 値をフォーマット（文字列は引用符で囲む）
 */
function formatValue(v) {
  return typeof v === "string" ? `"${v}"` : v;
}

/**
 * fieldType から Drizzle のカラム型を生成
 */
function getDrizzleColumnType(field) {
  const { name, fieldType, defaultValue, nullable } = field;
  const columnName = toSnakeCase(name);
  const camelName = toCamelCase(name);

  let columnDef = "";
  const hasDefaultValue = defaultValue !== undefined;
  const defaultSuffix = hasDefaultValue ? `.default(${formatValue(defaultValue)})` : "";

  switch (fieldType) {
    case "string":
    case "email":
    case "password":
    case "mediaUploader":
      columnDef = `text("${columnName}")${defaultSuffix}`;
      break;
    case "integer":
      columnDef = `integer("${columnName}")${defaultSuffix}`;
      break;
    case "float":
      columnDef = `doublePrecision("${columnName}")${defaultSuffix}`;
      break;
    case "bigint":
      columnDef = `bigint("${columnName}", { mode: "number" })${defaultSuffix}`;
      break;
    case "numeric(10,2)":
      columnDef = `numeric("${columnName}")${defaultSuffix}`;
      break;
    case "boolean":
      // Boolean型はデフォルトで notNull + default(false)
      // NULLを許容したい場合のみ nullable: true を明示的に指定
      columnDef = `boolean("${columnName}")`;
      if (nullable) {
        // 明示的にNULLを許容する場合
        if (hasDefaultValue) {
          columnDef += `.default(${defaultValue})`;
        }
      } else {
        // デフォルト: notNull + default(指定値 or false)
        columnDef += `.default(${hasDefaultValue ? defaultValue : false}).notNull()`;
      }
      break;
    case "enum":
      columnDef = `text("${columnName}")${defaultSuffix}`;
      break;
    case "date":
      columnDef = `date("${columnName}")${defaultSuffix}`;
      break;
    case "time":
      columnDef = `time("${columnName}")${defaultSuffix}`;
      break;
    case "timestamp With Time Zone":
      columnDef = `timestamp("${columnName}", { withTimezone: true })`;
      break;
    case "uuid":
      columnDef = `uuid("${columnName}")${defaultSuffix}`;
      break;
    case "array":
      columnDef = `jsonb("${columnName}").$type<string[]>().default([])`;
      break;
    default:
      columnDef = `text("${columnName}")${defaultSuffix}`;
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

    if (columnDef.includes("text(")) imports.add("text");
    if (columnDef.includes("integer(")) imports.add("integer");
    if (columnDef.includes("boolean(")) imports.add("boolean");
    if (columnDef.includes("jsonb(")) imports.add("jsonb");
    if (columnDef.includes("varchar(")) imports.add("varchar");
    if (columnDef.includes("doublePrecision(")) imports.add("doublePrecision");
    if (columnDef.includes("bigint(")) imports.add("bigint");
    if (columnDef.includes("numeric(")) imports.add("numeric");
    if (columnDef.includes("date(")) imports.add("date");
    if (columnDef.includes("time(")) imports.add("time");

    lines.push(`  /** ${field.label} */`);
    lines.push(`  ${camelName}: ${columnDef},`);
  }

  return { lines, imports: Array.from(imports) };
}

/**
 * generated/{roleId}/drizzle.ts を生成
 */
export function generateProfileDrizzle(roleConfig, profileConfig) {
  const roleId = roleConfig.id;
  const rolePascal = toPascalCase(roleId);
  const tableVar = `${rolePascal}ProfileTable`;
  const tableName = `${toSnakeCase(roleId)}_profiles`;

  const { lines: fieldLines, imports } = generateFieldDefinitions(profileConfig.fields);

  const content = `// src/features/core/userProfile/generated/${roleId}/drizzle.ts
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

  // generated/{roleId}/ フォルダを作成
  const roleDir = path.join(GENERATED_DIR, roleId);
  if (!fs.existsSync(roleDir)) {
    fs.mkdirSync(roleDir, { recursive: true });
  }

  const filePath = path.join(roleDir, "drizzle.ts");
  fs.writeFileSync(filePath, content);
}
