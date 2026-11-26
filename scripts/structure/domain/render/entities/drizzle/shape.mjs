// entities/drizzle.ts の手で持つ表の形(宣言の鍵 table・primaryKey・foreignKeys・checks・enums・columns・fields[].column、
// 鍵の正 src/lib/domain/definition/declaration.mjs TABLE_SHAPE_KEYS・COLUMN_KEYS)。鍵の無い config には何も足さない
// (今の生成物は変わらない)。dbObjects は書かない(SQL のファイルを名指すだけ。在ることは照らしの検査が見る)。
// 列・索引の項目の名前(columns・fields)は drizzle.ts のプロパティ名(fields[].name、システム列は createdAt 等)

import fs from "node:fs";
import path from "node:path";

import { TABLE_SHAPE_KEYS } from "../../../../../../src/lib/domain/node.mjs";
import { readDistrictMapAt } from "../../../../../../src/lib/districtMap/node.mjs";
import { toCamelCase, toSnakeCase } from "../../../../../../src/lib/stringCase/index.mjs";
import { enumNames } from "../../../domain/names.mjs";
import { FIELD_TYPES, columnFunction, isArrayFieldType, isEnumFieldType } from "../../../spec/fieldTypes.mjs";
import { buildColumn, formatValue } from "./columns.mjs";

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

/** リポジトリ相対のファイル(src/...)→ import の道(@/...、拡張子なし) */
function importPathOf(file) {
  if (!file.startsWith("src/")) throw new Error(`エラー: "${file}" はリポジトリ直下からの src/ で始まる道で書く`);
  return `@/${file.slice("src/".length).replace(/\.(ts|tsx|mts|mjs|js)$/, "")}`;
}

/** 主キーが名前なしの 1 列 = 列の .primaryKey()(DB の制約名は <表>_pkey。primaryKey() の制約にすると名前が変わる) */
export const isColumnPrimaryKey = (config) => config.primaryKey?.columns?.length === 1 && !config.primaryKey.name;

/** 列の主キーをその項目の行に付ける(項目がまだ無ければ何もしない) */
export function markColumnPrimaryKey(config, lines) {
  if (!isColumnPrimaryKey(config)) return lines;
  const prefix = `  ${config.primaryKey.columns[0]}: `;
  return lines.map((line) => (line.startsWith(prefix) && line.endsWith(",") ? `${line.slice(0, -1)}.primaryKey(),` : line));
}

/** @param {string[]} columns */
const tableColumns = (columns) => columns.map((column) => `table.${column}`).join(", ");

/**
 * pgTable の第 3 引数の項目(primaryKey・foreignKeys・checks)と、相手の表の import の行
 * @param {object} config
 * @param {string} tableName この表の物理名(自己参照の判定)
 * @param {string} rootDir 相手の表を探すリポジトリ
 * @param {string} selfFile この表の定義ファイル(リポジトリ相対)
 * @param {Set<string>} imports
 * @param {{ sql: boolean }} needs
 * @returns {{ entries: string[], importLines: string[] }}
 */
export function tableShapeEntries(config, tableName, rootDir, selfFile, imports, needs) {
  const entries = [];
  const importLines = new Set();
  if (config.primaryKey && !isColumnPrimaryKey(config)) {
    imports.add("primaryKey");
    const { columns, name } = config.primaryKey;
    entries.push(`  primaryKey({ ${name ? `name: "${name}", ` : ""}columns: [${tableColumns(columns)}] })`);
  }
  for (const fk of config.foreignKeys ?? []) {
    imports.add("foreignKey");
    const target = fk.references.table === tableName ? { name: "table", importLine: null } : foreignTableExport(rootDir, fk.references.table, selfFile);
    if (target.importLine) importLines.add(target.importLine);
    const foreign = fk.references.columns.map((column) => `${target.name}.${column}`).join(", ");
    let entry = `  foreignKey({ ${fk.name ? `name: "${fk.name}", ` : ""}columns: [${tableColumns(fk.columns)}], foreignColumns: [${foreign}] })`;
    if (fk.onDelete) entry += `.onDelete("${fk.onDelete.toLowerCase().replace("_", " ")}")`;
    if (fk.onUpdate) entry += `.onUpdate("${fk.onUpdate.toLowerCase().replace("_", " ")}")`;
    entries.push(entry);
  }
  for (const entry of config.checks ?? []) {
    imports.add("check");
    needs.sql = true;
    entries.push(`  check("${entry.name}", sql\`${entry.sql}\`)`);
  }
  return { entries, importLines: [...importLines] };
}

/**
 * 物理名の表の定義の export を、表の定義ファイルの走査(地区の地図の tableFiles)と字面から引く
 * @returns {{ name: string, importLine: string }}
 */
function foreignTableExport(rootDir, foreignTable, selfFile) {
  const found = readDistrictMapAt(rootDir).tableFiles.find((table) => table.name === foreignTable);
  if (!found) throw new Error(`エラー: foreignKeys の references.table "${foreignTable}" の表がどのドメインにもありません`);
  const text = fs.readFileSync(path.join(rootDir, found.file), "utf8");
  const match = new RegExp(`export const (\\w+)\\s*=\\s*pgTable\\(\\s*["'\`]${foreignTable}["'\`]`).exec(text);
  if (!match) throw new Error(`エラー: ${found.file} の表 "${foreignTable}" は export const <名前> = pgTable("${foreignTable}", …) の形でない`);
  if (found.file === selfFile) return { name: match[1], importLine: null };
  return { name: match[1], importLine: `import { ${match[1]} } from "${importPathOf(found.file)}";` };
}
