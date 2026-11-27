// scripts/structure/role/generator/generateProfileDrizzle.mjs
// entities/profiles/{roleId}/drizzle.ts の生成

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { toCamelCase, toPascalCase, toSnakeCase } from "../../../../src/lib/stringCase/index.mjs";
import { columnFunction, columnOptionsLiteral, fieldTypeSpec, isArrayFieldType } from "../../../../src/lib/domain/node.mjs";
import { profileFileHeader } from "./header.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../../../..");
const GENERATED_DIR = path.join(
  ROOT_DIR,
  "src/domains/core/userProfile/entities/profiles"
);

/**
 * 値をフォーマット（文字列は引用符で囲む）
 */
function formatValue(v) {
  return typeof v === "string" ? `"${v}"` : v;
}

/**
 * onDelete 設定から Drizzle オプション文字列を生成
 */
function buildOnDeleteOption(behavior) {
  switch (behavior) {
    case "CASCADE":
      return ', { onDelete: "cascade" }';
    case "SET_NULL":
      return ', { onDelete: "set null" }';
    case "RESTRICT":
      return ', { onDelete: "restrict" }';
    default:
      return "";
  }
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

  // 列関数と第 2 引数（columnOptions）は型の表（src/lib/domain/fields/fieldTypes.mjs）。プロフィール固有の規則: boolean の列は既定で notNull + default(false)、
  // タイムゾーン付き日時は既定値を付けない、配列はドメインと同じ text[]（空配列既定）、列関数の無い型（enum・表に無い型など）は text 列
  const typeFn = fieldTypeSpec(fieldType).column; // 表の行に列関数が無ければ undefined（型名を列関数にしない）
  const options = columnOptionsLiteral(fieldType);
  if (typeFn === "boolean") {
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
  } else if (typeFn === "timestamp") {
    columnDef = `timestamp("${columnName}"${options ? `, ${options}` : ""})`;
  } else if (isArrayFieldType(fieldType)) {
    columnDef = `text("${columnName}").array().default([])`;
  } else if (typeFn) {
    // import は generateFieldDefinitions が列定義の文字列から拾う（表に新しい列関数を足したらそちらにも足す）
    columnDef = `${typeFn}("${columnName}"${options ? `, ${options}` : ""})${defaultSuffix}`;
  } else {
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

  return { lines, imports };
}

/**
 * belongsTo リレーションの FK カラム定義を生成
 */
function generateBelongsToColumns(relations, profileTableName) {
  const lines = [];
  const imports = new Set();
  const relationImports = [];

  const belongsToRels = (relations || []).filter((r) => r.relationType === "belongsTo");
  if (belongsToRels.length === 0) return { lines, imports, relationImports };

  for (const rel of belongsToRels) {
    const relationPascal = toPascalCase(rel.domain);
    const relationCamel = toCamelCase(rel.domain);
    const columnName = toSnakeCase(rel.fieldName);
    const camelName = toCamelCase(rel.fieldName);
    const onDelete = rel.onDelete || "RESTRICT";
    const opt = buildOnDeleteOption(onDelete);

    // FK カラムの型（デフォルトは uuid）
    const colFn = columnFunction(rel.fieldType || "uuid") === "uuid" ? "uuid" : "text";
    imports.add(colFn);

    let line = `  /** ${rel.label} */\n`;
    line += `  ${camelName}: ${colFn}("${columnName}")`;
    if (rel.required) line += ".notNull()";
    line += `\n    .references(() => ${relationPascal}Table.id${opt}),`;
    lines.push(line);

    // import 対象を記録
    relationImports.push({
      domain: relationCamel,
      tableVar: `${relationPascal}Table`,
    });
  }

  return { lines, imports, relationImports };
}

/** プロフィールの多対多の止め(D354 で中間の表はいつも自分の登録。プロフィールの結びの登録の置き場が決まるまで書けない) */
export const PROFILE_JUNCTION_STOP =
  "プロフィールの belongsToMany はまだ書けません: 多対多の中間の表はいつも自分の登録(D354)ですが、プロフィールの表は core の userProfile にあり、fork がそこへ結びの登録を足せないため置き場が決まっていません(上流・fork とも使っている所は無い)";

/** プロフィールに belongsToMany があれば止める(中間の表は書かない) */
export function assertNoProfileJunction(relations) {
  if ((relations || []).some((r) => r.relationType === "belongsToMany")) throw new Error(PROFILE_JUNCTION_STOP);
}

/**
 * entities/profiles/{roleId}/drizzle.ts を生成
 */
export function generateProfileDrizzle(roleConfig, profileConfig) {
  const roleId = roleConfig.id;
  const rolePascal = toPascalCase(roleId);
  const tableVar = `${rolePascal}ProfileTable`;
  const tableName = `${toSnakeCase(roleId)}_profiles`;

  const { lines: fieldLines, imports } = generateFieldDefinitions(profileConfig.fields);

  // リレーション処理
  const belongsTo = generateBelongsToColumns(
    profileConfig.relations,
    tableName
  );
  assertNoProfileJunction(profileConfig.relations);

  // belongsTo の imports をマージ
  for (const imp of belongsTo.imports) {
    imports.add(imp);
  }

  // リレーション先テーブルの import 文を収集（重複排除）
  const allRelationImports = new Map();
  for (const ri of belongsTo.relationImports) {
    allRelationImports.set(ri.domain, ri.tableVar);
  }

  const relationImportLines = Array.from(allRelationImports.entries())
    .map(
      ([domain, tableVar]) =>
        `import { ${tableVar} } from "@/domains/${domain}/entities/drizzle";`
    )
    .join("\n");
  const relationImportBlock = relationImportLines ? `\n${relationImportLines}` : "";

  // belongsTo FK カラムのブロック
  const belongsToBlock =
    belongsTo.lines.length > 0
      ? `\n  // ==========================================================================
  // リレーション（外部キー）
  // ==========================================================================
${belongsTo.lines.join("\n")}\n`
      : "";

  // 中間テーブルブロック

  const content = `${profileFileHeader(roleId)}
// src/domains/core/userProfile/entities/profiles/${roleId}/drizzle.ts
// ${roleConfig.label}（${roleId}）ロール用のプロフィールテーブル
//
// 元情報: src/domains/core/userProfile/profiles/${roleId}.profile.json
// このファイルは pnpm generate role によって自動生成されました

import { UserTable } from "@/domains/core/user/entities/drizzle";
import { ${Array.from(imports).join(", ")}, pgTable } from "drizzle-orm/pg-core";${relationImportBlock}

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
${belongsToBlock}
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

  // entities/profiles/{roleId}/ フォルダを作成
  const roleDir = path.join(GENERATED_DIR, roleId);
  if (!fs.existsSync(roleDir)) {
    fs.mkdirSync(roleDir, { recursive: true });
  }

  const filePath = path.join(roleDir, "drizzle.ts");
  fs.writeFileSync(filePath, content);
}
