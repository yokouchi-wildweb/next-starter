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
 * リレーション先ドメインのテーブル名を取得
 * domain.json が存在すれば plural を使用、なければ snake_case 化
 */
function getForeignTableName(domainName) {
  const domainCamel = toCamelCase(domainName) || domainName;
  const featuresDir = path.join(ROOT_DIR, "src", "features");
  const candidates = [
    path.join(featuresDir, domainCamel, "domain.json"),
    path.join(featuresDir, "core", domainCamel, "domain.json"),
  ];
  for (const configPath of candidates) {
    if (fs.existsSync(configPath)) {
      try {
        const foreignConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
        if (foreignConfig.plural) {
          return toSnakeCase(foreignConfig.plural);
        }
      } catch {
        // JSON パースエラー時はフォールバック
      }
      break;
    }
  }
  return toSnakeCase(domainName);
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
    const colType = rel.fieldType || "uuid";
    imports.add(colType === "uuid" ? "uuid" : "text");
    const colFn = colType === "uuid" ? "uuid" : "text";

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

/**
 * belongsToMany リレーションの中間テーブル定義を生成
 */
function generateBelongsToManyTables(relations, roleId, rolePascal, profileTableVar) {
  const blocks = [];
  const relationImports = [];

  const m2mRels = (relations || []).filter(
    (r) => r.relationType === "belongsToMany" && r.includeRelationTable !== false
  );
  if (m2mRels.length === 0) return { blocks, relationImports, needsPrimaryKey: false };

  for (const rel of m2mRels) {
    const relationPascal = toPascalCase(rel.domain);
    const relationCamel = toCamelCase(rel.domain);
    const junctionPascal = `${rolePascal}ProfileTo${relationPascal}`;
    const junctionTableVar = `${junctionPascal}Table`;
    const junctionTableName = toSnakeCase(junctionPascal);
    const sourceCol = `${toSnakeCase(roleId)}_profile_id`;
    const targetCol = `${toSnakeCase(rel.domain)}_id`;
    const sourceProp = `${toCamelCase(roleId)}ProfileId`;
    const targetProp = `${relationCamel}Id`;

    const block = `
export const ${junctionTableVar} = pgTable(
  "${junctionTableName}",
  {
    ${sourceProp}: uuid("${sourceCol}")
      .notNull()
      .references(() => ${profileTableVar}.id, { onDelete: "cascade" }),
    ${targetProp}: uuid("${targetCol}")
      .notNull()
      .references(() => ${relationPascal}Table.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.${sourceProp}, table.${targetProp}] }),
  }),
);`;

    blocks.push(block);

    relationImports.push({
      domain: relationCamel,
      tableVar: `${relationPascal}Table`,
    });
  }

  return { blocks, relationImports, needsPrimaryKey: m2mRels.length > 0 };
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

  // リレーション処理
  const belongsTo = generateBelongsToColumns(
    profileConfig.relations,
    tableName
  );
  const m2m = generateBelongsToManyTables(
    profileConfig.relations,
    roleId,
    rolePascal,
    tableVar
  );

  // belongsTo の imports をマージ
  for (const imp of belongsTo.imports) {
    imports.add(imp);
  }
  if (m2m.needsPrimaryKey) {
    imports.add("primaryKey");
  }

  // リレーション先テーブルの import 文を収集（重複排除）
  const allRelationImports = new Map();
  for (const ri of [...belongsTo.relationImports, ...m2m.relationImports]) {
    allRelationImports.set(ri.domain, ri.tableVar);
  }

  const relationImportLines = Array.from(allRelationImports.entries())
    .map(
      ([domain, tableVar]) =>
        `import { ${tableVar} } from "@/features/${domain}/entities/drizzle";`
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
  const m2mBlock = m2m.blocks.join("\n");

  const content = `// src/features/core/userProfile/generated/${roleId}/drizzle.ts
// ${roleConfig.label}（${roleId}）ロール用のプロフィールテーブル
//
// 元情報: src/features/core/userProfile/profiles/${roleId}.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

import { UserTable } from "@/features/core/user/entities/drizzle";
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
${m2mBlock}
`;

  // generated/{roleId}/ フォルダを作成
  const roleDir = path.join(GENERATED_DIR, roleId);
  if (!fs.existsSync(roleDir)) {
    fs.mkdirSync(roleDir, { recursive: true });
  }

  const filePath = path.join(roleDir, "drizzle.ts");
  fs.writeFileSync(filePath, content);
}
