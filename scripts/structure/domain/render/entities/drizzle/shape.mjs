// entities/drizzle.ts の手で持つ表の形(宣言の鍵 table・primaryKey・foreignKeys・checks・enums・columns・fields[].column、
// 鍵の正 src/lib/domain/definition/declaration.mjs TABLE_SHAPE_KEYS・COLUMN_KEYS)。鍵の無い config には何も足さない
// (今の生成物は変わらない)。dbObjects は書かない(SQL のファイルを名指すだけ。在ることは照らしの検査が見る)。
// 列・索引の項目の名前(columns・fields)は drizzle.ts のプロパティ名(fields[].name、システム列は createdAt 等)

import { TABLE_SHAPE_KEYS } from "../../../../../../src/lib/domain/node.mjs";
import { toCamelCase, toSnakeCase } from "../../../../../../src/lib/stringCase/index.mjs";
import { enumNames } from "../../../domain/names.mjs";
import { FIELD_TYPES, columnFunction, isArrayFieldType, isEnumFieldType } from "../../../spec/fieldTypes.mjs";
import { buildColumn, formatValue } from "./columns.mjs";
import { importPathOf } from "./tableShape.mjs";

/** fields[].column.type(SQL の型の書き方)→ drizzle の列関数と第 2 引数。( ) の引数は precision・scale・length */
const SQL_COLUMN_TYPES = {
  smallint: { fn: "smallint" },
  integer: { fn: "integer" },
  bigint: { fn: "bigint", options: '{ mode: "number" }' },
  numeric: { fn: "numeric", args: ["precision", "scale"] },
  real: { fn: "real" },
  "double precision": { fn: "doublePrecision" },
  text: { fn: "text" },
  varchar: { fn: "varchar", args: ["length"] },
  uuid: { fn: "uuid" },
  inet: { fn: "inet" },
  jsonb: { fn: "jsonb" },
  json: { fn: "json" },
  boolean: { fn: "boolean" },
  date: { fn: "date" },
  timestamp: { fn: "timestamp" },
  "timestamp with time zone": { fn: "timestamp", options: "{ withTimezone: true }" },
};

const IDENTITY_SUFFIX = { always: ".generatedAlwaysAsIdentity()", byDefault: ".generatedByDefaultAsIdentity()" };

/** 宣言に表の形の鍵(または fields[].column)があるか */
export function hasTableShape(config) {
  return Object.keys(config ?? {}).some((key) => TABLE_SHAPE_KEYS.has(key)) || (config?.fields ?? []).some((field) => field.column !== undefined);
}

/** enums[] の名前 → drizzle.ts の定数名 */
export const declaredEnumConst = (name) => `${toCamelCase(name)}Enum`;

/**
 * column.type の列関数の呼び出し(配列 [] は .array())
 * @param {string} type
 * @param {string} columnName
 * @param {Set<string>} imports
 */
function sqlTypeColumn(type, columnName, imports) {
  const array = type.endsWith("[]");
  const base = array ? type.slice(0, -2).trim() : type.trim();
  const match = /^([a-z ]+?)\s*(?:\(\s*([0-9]+)\s*(?:,\s*([0-9]+)\s*)?\))?$/.exec(base);
  const spec = match ? SQL_COLUMN_TYPES[match[1]] : undefined;
  if (!match || !spec) throw new Error(`エラー: fields[].column.type "${type}" は書けない型です(書ける型: ${Object.keys(SQL_COLUMN_TYPES).join(" / ")}、配列は [])`);
  const numbers = [match[2], match[3]].filter((value) => value !== undefined);
  if (numbers.length > 0 && !spec.args) throw new Error(`エラー: fields[].column.type "${type}" の型は ( ) の引数を取りません`);
  imports.add(spec.fn);
  const options = numbers.length > 0 ? `{ ${numbers.map((value, index) => `${spec.args[index]}: ${value}`).join(", ")} }` : spec.options;
  return `${spec.fn}("${columnName}"${options ? `, ${options}` : ""})${array ? ".array()" : ""}`;
}

/** default の値: JSON の値か { sql } */
function defaultLiteral(value, needs) {
  if (value !== null && typeof value === "object" && !Array.isArray(value) && typeof value.sql === "string" && Object.keys(value).length === 1) {
    needs.sql = true;
    return `sql\`${value.sql}\``;
  }
  return typeof value === "object" ? JSON.stringify(value) : formatValue(value);
}

/**
 * column を持つ項目の列の行
 * @param {{ config: object, camel: string, pascal: string }} ctx
 * @param {object} field fields[] の 1 つ(column あり)
 * @param {Set<string>} imports
 * @param {string[]} enumDefs 項目の enum の定義(fieldType enum で column.enum の無い時)
 * @param {{ sql: boolean }} needs sql の import が要るか
 * @returns {{ line: string, uniqueColumnName: string | null }} uniqueColumnName = ソフトデリートの部分ユニークへ回す列
 */
export function shapedFieldColumn(ctx, field, imports, enumDefs, needs) {
  const { config, camel, pascal } = ctx;
  const column = field.column;
  const columnName = column.name ?? toSnakeCase(field.name);
  let base;
  if (column.enum !== undefined) {
    if (!(config.enums ?? []).some((entry) => entry.name === column.enum)) {
      throw new Error(`エラー: fields "${field.name}" の column.enum "${column.enum}" が enums にありません`);
    }
    base = `${declaredEnumConst(column.enum)}("${columnName}")`;
  } else if (column.type !== undefined) {
    base = sqlTypeColumn(column.type, columnName, imports);
  } else if (isEnumFieldType(field.fieldType)) {
    imports.add("pgEnum");
    const names = enumNames(camel, pascal, field.name);
    const values = field.options ? field.options.map((o) => formatValue(o.value)).join(", ") : "";
    enumDefs.push(`export const ${names.constName} = pgEnum("${names.enumName}", [${values}]);`);
    base = `${names.constName}("${columnName}")`;
  } else if (isArrayFieldType(field.fieldType)) {
    imports.add("text");
    base = `text("${columnName}").array()`;
  } else {
    if (!Object.hasOwn(FIELD_TYPES, field.fieldType)) {
      throw new Error(`エラー: fields "${field.name}" の fieldType "${field.fieldType}" は型の表に無い。column.type で列の型を書く`);
    }
    const typeFn = columnFunction(field.fieldType);
    imports.add(typeFn);
    base = buildColumn(typeFn, columnName, field.fieldType);
  }
  if (column.default !== undefined && field.defaultValue !== undefined) {
    throw new Error(`エラー: fields "${field.name}" に defaultValue と column.default の両方があります(1 つにする)`);
  }
  const identity = column.identity !== undefined ? IDENTITY_SUFFIX[column.identity] : "";
  if (identity === undefined) throw new Error(`エラー: fields "${field.name}" の column.identity "${column.identity}" は always / byDefault のどちらか`);
  const notNull = (column.notNull ?? field.required) ? ".notNull()" : "";
  let unique = column.unique === true ? ".unique()" : "";
  let uniqueColumnName = null;
  if (field.unique && !unique) {
    if (config.useSoftDelete) uniqueColumnName = columnName;
    else unique = ".unique()";
  }
  const defaultValue = column.default ?? field.defaultValue;
  const defaultSuffix = defaultValue !== undefined ? `.default(${defaultLiteral(defaultValue, needs)})` : "";
  return { line: `  ${field.name}: ${base}${identity}${notNull}${unique}${defaultSuffix},`, uniqueColumnName };
}

/**
 * 表だけの列(columns[])の行: 項目でないので fieldType を持たず、column.type か column.enum で列関数を決める
 * @returns {string[]}
 */
export function tableOnlyColumns(ctx, imports, enumDefs, needs) {
  return (ctx.config.columns ?? []).map((entry) => {
    if (entry.column?.type === undefined && entry.column?.enum === undefined) {
      throw new Error(`エラー: columns "${entry.name}" は column.type か column.enum を書く(表だけの列は項目の型を持たない)`);
    }
    return shapedFieldColumn(ctx, { name: entry.name, column: entry.column }, imports, enumDefs, needs).line;
  });
}

/**
 * enums[] の定義と valuesFrom の import の行
 * @param {object} config
 * @param {Set<string>} imports
 * @returns {{ defs: string[], importLines: string[] }}
 */
export function declaredEnums(config, imports) {
  const defs = [];
  const importLines = [];
  for (const entry of config.enums ?? []) {
    imports.add("pgEnum");
    const constName = declaredEnumConst(entry.name);
    if (entry.valuesFrom) {
      const { file, export: exportName } = entry.valuesFrom;
      importLines.push(`import { ${exportName} } from "${importPathOf(file)}";`);
      defs.push(`export const ${constName} = pgEnum("${entry.name}", ${exportName});`);
    } else if (Array.isArray(entry.values) && entry.values.length > 0) {
      defs.push(`export const ${constName} = pgEnum("${entry.name}", [${entry.values.map(formatValue).join(", ")}]);`);
    } else {
      throw new Error(`エラー: enums "${entry.name}" は values(空でない配列)か valuesFrom { file, export } のどちらかを書く`);
    }
  }
  return { defs, importLines };
}
