// entities/drizzle.ts の列定義（id と fields）。belongsTo の外部キー列は foreignKeys.mjs、多対多の中間の表は結びの登録(D354)が自分の表として書く。
// 型 → 列関数と第 2 引数の対応は spec/fieldTypes.mjs の表（配列・enum だけここで形を変える）

import { toSnakeCase } from "../../../../../../src/lib/stringCase/index.mjs";
import { enumNames } from "../../../domain/names.mjs";
import { FIELD_TYPES, columnFunction, columnOptionsLiteral, isArrayFieldType, isCollectionFieldType, isEnumFieldType } from "../../../spec/fieldTypes.mjs";

/** 列関数の呼び出し。第 2 引数は型の表の columnOptions（mode・precision / scale・withTimezone） */
export function buildColumn(typeFn, columnName, fieldType) {
  const options = columnOptionsLiteral(fieldType);
  if (options) return `${typeFn}("${columnName}", ${options})`;
  return `${typeFn}("${columnName}")`;
}

export function formatValue(v) {
  if (typeof v === "string") return `"${v}"`;
  // オブジェクト・配列の既定(jsonb の {} など)は JSON の字面で(そのまま埋めると [object Object] になる)
  return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
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
 * @param {(field: object, enumDefs: string[]) => { line: string, uniqueColumnName: string | null }} [shapedColumn]
 *   列の形 column を持つ項目の行(./shape.mjs の shapedFieldColumn を呼び手が結ぶ。column の無い項目はここの今の形)
 * @returns {{ lines: string[], enumDefs: string[], uniqueFields: { name: string, columnName: string }[] }}
 *   uniqueFields = ソフトデリート時に部分インデックスへ変換する単一ユニーク列（.unique() を付けない）
 */
export function fieldColumns(ctx, imports, shapedColumn) {
  const { config, camel, pascal } = ctx;
  const lines = [];
  const enumDefs = [];
  // 単一フィールドのユニーク制約 (f.unique) は生成だけ実装済み（質問フローは無く、entity.json に "unique": true を手で書く）。
  // 複数の列のユニークは indexes[] の unique: true で書く(indexes.mjs)
  const uniqueFields = [];

  (config.fields || []).forEach((f) => {
    // 主の集まりの項目は列を持たない（従属の行。collections オプションで読み書きする）
    if (isCollectionFieldType(f.fieldType)) return;
    if (f.column !== undefined && shapedColumn) {
      const shaped = shapedColumn(f, enumDefs);
      lines.push(shaped.line);
      if (shaped.uniqueColumnName) uniqueFields.push({ name: f.name, columnName: shaped.uniqueColumnName });
      return;
    }
    const defaultSuffix = f.defaultValue !== undefined ? `.default(${formatValue(f.defaultValue)})` : "";

    if (isEnumFieldType(f.fieldType)) {
      imports.add("pgEnum");
      const names = enumNames(camel, pascal, f.name);
      const values = f.options ? f.options.map((o) => formatValue(o.value)).join(", ") : "";
      enumDefs.push(`export const ${names.constName} = pgEnum("${names.enumName}", [${values}]);`);
      const notNull = f.required ? ".notNull()" : "";
      lines.push(`  ${f.name}: ${names.constName}("${toSnakeCase(f.name)}")${notNull}${defaultSuffix},`);
    } else if (isArrayFieldType(f.fieldType)) {
      imports.add("text");
      lines.push(arrayColumn(f.name, f.required));
    } else {
      // 型の表に無い fieldType は列関数を決められない(型名をそのまま import に書くと壊れた TS になる)
      if (!Object.hasOwn(FIELD_TYPES, f.fieldType)) {
        throw new Error(`エラー: fields "${f.name}" の fieldType "${f.fieldType}" は型の表(src/lib/domain/fields/fieldTypes.mjs)に無い。表の型にするか、entity.json の column.type で列の型を書く`);
      }
      const typeFn = columnFunction(f.fieldType);
      imports.add(typeFn);
      const columnName = toSnakeCase(f.name);
      const column = buildColumn(typeFn, columnName, f.fieldType);
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
