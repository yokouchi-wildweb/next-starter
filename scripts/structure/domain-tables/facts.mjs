// scripts/structure/domain-tables/facts.mjs
// 表の事実の読み手と比べ方(照らしの検査の部品)。drizzle の pgTable を getTableConfig で読み、素の値(文字列・真偽・配列)の
// 平らな表にする: 「<どこ>」→ 値。比べ方は同じ「どこ」の値を比べ、片方だけの物も 1 行にする。SQL の式は PgDialect で文字列にする

import { is, SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";

const dialect = new PgDialect();

/** SQL の式 → 文字列(引数は $1 の代わりに値を埋める) */
function sqlText(value) {
  if (value === undefined || value === null) return null;
  if (!is(value, SQL)) return JSON.stringify(value);
  const query = dialect.sqlToQuery(value);
  return query.params.reduce((text, param, index) => text.replace(`$${index + 1}`, JSON.stringify(param)), query.sql);
}

/** 索引の 1 項目(列か式)→ 文字列 */
function indexPart(part) {
  if (is(part, SQL)) return `expr ${sqlText(part)}`;
  const config = part.indexConfig ?? {};
  return [part.name, config.order === "desc" ? "desc" : null, config.opClass ? `op ${config.opClass}` : null].filter(Boolean).join(" ");
}

/**
 * 表の事実(平らな表)
 * @param {import("drizzle-orm/pg-core").PgTable} table
 * @returns {{ name: string, facts: Record<string, string> }}
 */
export function tableFactsOf(table) {
  const config = getTableConfig(table);
  /** @type {Record<string, string>} */
  const facts = {};
  const put = (where, value) => {
    facts[where] = typeof value === "string" ? value : JSON.stringify(value);
  };
  for (const column of config.columns) {
    const at = `列 ${column.name}`;
    put(`${at} の型`, column.getSQLType());
    put(`${at} の NOT NULL`, column.notNull);
    put(`${at} の既定`, column.hasDefault ? (sqlText(column.default) ?? "(関数の既定)") : null);
    put(`${at} の主キー`, column.primary);
    put(`${at} の identity`, column.generatedIdentity?.type ?? null);
    put(`${at} のユニーク`, column.isUnique ? (column.uniqueName ?? true) : false);
    const enumConfig = /** @type {{ enum?: { enumName: string, enumValues: string[] } }} */ (/** @type {unknown} */ (column)).enum;
    if (enumConfig) put(`${at} の enum`, `${enumConfig.enumName} [${enumConfig.enumValues.join(", ")}]`);
  }
  for (const pk of config.primaryKeys) put(`主キー ${pk.getName()}`, pk.columns.map((column) => column.name));
  for (const fk of config.foreignKeys) {
    const reference = fk.reference();
    put(`FK ${fk.getName()}`, {
      columns: reference.columns.map((column) => column.name),
      table: getTableConfig(reference.foreignTable).name,
      foreignColumns: reference.foreignColumns.map((column) => column.name),
      onDelete: fk.onDelete ?? "no action",
      onUpdate: fk.onUpdate ?? "no action",
    });
  }
  for (const index of config.indexes) {
    const c = index.config;
    put(`索引 ${c.name}`, {
      unique: Boolean(c.unique),
      parts: c.columns.map(indexPart),
      where: sqlText(c.where),
      method: c.method ?? "btree",
    });
  }
  for (const check of config.checks) put(`check ${check.name}`, sqlText(check.value));
  for (const unique of config.uniqueConstraints) put(`ユニーク ${unique.getName()}`, unique.columns.map((column) => column.name));
  return { name: config.name, facts };
}

/**
 * 2 つの表の事実の違い(宣言から組んだ表 / 今の表)
 * @param {{ name: string, facts: Record<string, string> }} expected
 * @param {{ name: string, facts: Record<string, string> }} actual
 * @returns {string[]} `<表>: <どこ>: 宣言 <値> / 今 <値>`(無い側は「なし」)。並びは「どこ」の順
 */
export function diffTableFacts(expected, actual) {
  const lines = [];
  if (expected.name !== actual.name) lines.push(`${expected.name}: 表の名前: 宣言 ${expected.name} / 今 ${actual.name}`);
  const wheres = [...new Set([...Object.keys(expected.facts), ...Object.keys(actual.facts)])].sort();
  for (const where of wheres) {
    const left = expected.facts[where] ?? "なし";
    const right = actual.facts[where] ?? "なし";
    if (left !== right) lines.push(`${expected.name}: ${where}: 宣言 ${left} / 今 ${right}`);
  }
  return lines;
}
