// entities/drizzle.ts の列定義（id と fields）。belongsTo の外部キー列は foreignKeys.mjs、中間テーブルは junction.mjs。
// 型 → 列関数の対応は spec/fieldTypes.mjs の表（配列・enum・タイムゾーン付きだけここで形を変える）

import { toSnakeCase } from "../../../../../src/utils/stringCase.mjs";
import { enumNames } from "../../../domain/names.mjs";
import { columnFunction, isArrayFieldType, isCollectionFieldType } from "../../../spec/fieldTypes.mjs";

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

/** text[] の列（必須は NOT NULL + 空配列既定、任意は nullable = 既存データの NULL を許容） */
function arrayColumn(name, required) {
  return required ? `  ${name}: text("${toSnakeCase(name)}").array().default([]).notNull(),` : `  ${name}: text("${toSnakeCase(name)}").array(),`;
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
    // 主の集まりの項目は列を持たない（従属の行。collections オプションで読み書きする）
    if (isCollectionFieldType(f.fieldType)) return;
    const defaultSuffix = f.defaultValue !== undefined ? `.default(${formatValue(f.defaultValue)})` : "";

    if (f.fieldType === "enum") {
      imports.add("pgEnum");
      const names = enumNames(camel, pascal, f.name);
      const values = f.options ? f.options.map((o) => formatValue(o.value)).join(", ") : "";
      enumDefs.push(`export const ${names.constName} = pgEnum("${names.enumName}", [${values}]);`);
      const notNull = f.required ? ".notNull()" : "";
      lines.push(`  ${f.name}: ${names.constName}("${toSnakeCase(f.name)}")${notNull}${defaultSuffix},`);
    } else if (isArrayFieldType(f.fieldType)) {
      imports.add("text");
      lines.push(arrayColumn(f.name, f.required));
    } else if (f.fieldType === "mediaUploaderMulti") {
      // mediaUploaderMulti は常に NOT NULL + 空配列既定（null/[] の混在を避ける）
      imports.add("text");
      lines.push(arrayColumn(f.name, true));
    } else if (f.fieldType === "timestamp With Time Zone") {
      imports.add("timestamp");
      let column = `timestamp("${toSnakeCase(f.name)}", { withTimezone: true })`;
      if (f.required) column += ".notNull()";
      lines.push(`  ${f.name}: ${column},`);
    } else {
      const typeFn = columnFunction(f.fieldType);
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
