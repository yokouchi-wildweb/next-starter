// entities/drizzle.ts の列定義（id と fields）。belongsTo の外部キー列は foreignKeys.mjs、中間テーブルは junction.mjs

import { toSnakeCase } from "../../../../../src/utils/stringCase.mjs";
import { enumNames } from "../../../domain/names.mjs";

/** domain.json の fieldType → drizzle-orm/pg-core の列関数名 */
export function mapType(t) {
  switch (t) {
    case "string":
    case "email":
    case "password":
    case "mediaUploader":
    case "mediaUploaderMulti":
      return "text";
    case "integer":
      return "integer";
    case "float":
      return "doublePrecision";
    case "bigint":
      return "bigint";
    case "numeric(10,2)":
      return "numeric";
    case "boolean":
      return "boolean";
    case "date":
      return "date";
    case "time":
      return "time";
    case "uuid":
      return "uuid";
    case "timestamp With Time Zone":
      return "timestamp";
    case "jsonb":
      return "jsonb";
    default:
      return t;
  }
}

export function buildColumn(typeFn, columnName) {
  if (typeFn === "bigint") {
    return `bigint("${columnName}", { mode: "number" })`;
  }
  return `${typeFn}("${columnName}")`;
}

export function formatValue(v) {
  return typeof v === "string" ? `"${v}"` : v;
}

/** id 列。idType に応じて uuid / text / integer */
export function idColumn(config, imports) {
  switch (config.idType) {
    case "uuid":
      imports.add("uuid");
      return `  id: uuid("id").defaultRandom().primaryKey(),`;
    case "string":
      imports.add("text");
      return `  id: text("id").primaryKey(),`;
    case "number":
      imports.add("integer");
      return `  id: integer("id").primaryKey(),`;
    default:
      imports.add("text");
      return `  id: text("id").primaryKey(),`;
  }
}

/**
 * fields の列定義。
 * @returns {{ lines: string[], enumDefs: string[], uniqueFields: { name: string, columnName: string }[] }}
 *   uniqueFields = ソフトデリート時に部分インデックスへ変換する単一ユニーク列（.unique() を付けない）
 */
export function fieldColumns(ctx, imports) {
  const { config, camel, pascal } = ctx;
  const lines = [];
  const enumDefs = [];
  // 単一フィールドのユニーク制約 (f.unique) は生成だけ実装済み（質問フローは無く、domain.json に "unique": true を手で書く）。
  // 複合ユニーク制約 (compositeUniques) は質問フロー込み
  const uniqueFields = [];

  (config.fields || []).forEach((f) => {
    const hasDefaultValue = f.defaultValue !== undefined;
    const defaultSuffix = hasDefaultValue ? `.default(${formatValue(f.defaultValue)})` : "";

    if (f.fieldType === "enum") {
      imports.add("pgEnum");
      const names = enumNames(camel, pascal, f.name);
      const values = f.options ? f.options.map((o) => formatValue(o.value)).join(", ") : "";
      enumDefs.push(`export const ${names.constName} = pgEnum("${names.enumName}", [${values}]);`);
      const notNull = f.required ? ".notNull()" : "";
      lines.push(`  ${f.name}: ${names.constName}("${toSnakeCase(f.name)}")${notNull}${defaultSuffix},`);
    } else if (f.fieldType === "array" || f.fieldType === "stringArray") {
      imports.add("text");
      if (f.required) {
        // required: true → NOT NULL + デフォルト空配列
        lines.push(`  ${f.name}: text("${toSnakeCase(f.name)}").array().default([]).notNull(),`);
      } else {
        // required: false → nullable（既存データの NULL を許容）
        lines.push(`  ${f.name}: text("${toSnakeCase(f.name)}").array(),`);
      }
    } else if (f.fieldType === "mediaUploaderMulti") {
      // mediaUploaderMulti は常に NOT NULL + 空配列既定（null/[] の混在を避ける）
      imports.add("text");
      lines.push(`  ${f.name}: text("${toSnakeCase(f.name)}").array().default([]).notNull(),`);
    } else if (f.fieldType === "timestamp With Time Zone") {
      imports.add("timestamp");
      let column = `timestamp("${toSnakeCase(f.name)}", { withTimezone: true })`;
      if (f.required) column += ".notNull()";
      lines.push(`  ${f.name}: ${column},`);
    } else {
      const typeFn = mapType(f.fieldType);
      imports.add(typeFn);
      const columnName = toSnakeCase(f.name);
      const column = buildColumn(typeFn, columnName);
      const notNull = f.required ? ".notNull()" : "";
      let uniqueSuffix = "";
      if (f.unique) {
        if (config.useSoftDelete) {
          // ソフトデリート時は部分インデックスを使うため、ここでは .unique() を付けない
          uniqueFields.push({ name: f.name, columnName });
        } else {
          uniqueSuffix = ".unique()";
        }
      }
      lines.push(`  ${f.name}: ${column}${notNull}${uniqueSuffix}${defaultSuffix},`);
    }
  });

  return { lines, enumDefs, uniqueFields };
}

/** createdAt / updatedAt / deletedAt のシステム列 */
export function systemColumns(config, imports) {
  const lines = [];
  if (config.useCreatedAt) {
    imports.add("timestamp");
    lines.push('  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),');
  }
  if (config.useUpdatedAt) {
    imports.add("timestamp");
    lines.push('  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),');
  }
  if (config.useSoftDelete) {
    imports.add("timestamp");
    lines.push('  deletedAt: timestamp("deleted_at", { withTimezone: true }),');
  }
  return lines;
}
