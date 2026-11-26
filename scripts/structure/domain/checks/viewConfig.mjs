// 検査: 一覧・検索の設定（searchFields・defaultOrderBy・tableFields）。
// 無い項目名は生成物で `table.<名>` になり tsc で落ちる / 一覧で空の列になる。
// 文字列でない列の検索: Neon は buildSearchWhere が `::text` に cast するので警告しない。Firestore だけ警告(文字列の前方一致で比べる)
// 規則の正: src/domains/README.md「API」（searchFields / defaultOrderBy / tableFields）。複数の列のユニークは indexes[] の unique(entity.json)

import { fieldTypeSpec } from "../spec/fieldTypes.mjs";

const SYSTEM_COLUMNS = ["id", "createdAt", "updatedAt"];
const ORDER_DIRECTIONS = new Set(["ASC", "DESC"]);
const NULLS_ORDER = new Set(["FIRST", "LAST"]);

/** 検索できる型 = 列が text の型（ilike で比べる） */
const isSearchable = (field) => fieldTypeSpec(field.fieldType).column === "text";

/**
 * 止めない警告: Firestore の searchFields の文字列でない列(Neon は buildSearchWhere が `::text` に cast するので対象外)
 * @param {object} config 登録の entity.json
 * @returns {string[]}
 */
export function viewConfigWarnings(config) {
  if (config.dbEngine === "Neon") return [];
  const fields = new Map((config.fields ?? []).filter((f) => typeof f?.name === "string").map((f) => [f.name, f]));
  return (config.searchFields ?? [])
    .filter((name) => fields.has(name) && !isSearchable(fields.get(name)))
    .map((name) => `searchFields "${name}" は文字列の列ではありません（fieldType "${fields.get(name).fieldType}"）。キーワード検索で失敗するおそれがあります`);
}

/**
 * @param {object} config 登録の entity.json
 * @returns {string[]} 問題（空なら無し）
 */
export function viewConfigIssues(config) {
  const issues = [];
  const fields = new Map((config.fields ?? []).filter((f) => typeof f?.name === "string").map((f) => [f.name, f]));
  const relationKeys = (config.relations ?? []).filter((r) => typeof r?.fieldName === "string").map((r) => r.fieldName);
  const columns = new Set([...SYSTEM_COLUMNS, ...fields.keys(), ...relationKeys]);

  for (const name of config.searchFields ?? []) {
    if (!fields.has(name) && !relationKeys.includes(name)) issues.push(`searchFields "${name}" が fields・relations の fieldName にありません`);
  }

  for (const [index, entry] of (config.defaultOrderBy ?? []).entries()) {
    if (!Array.isArray(entry) || entry.length < 2 || entry.length > 3) {
      issues.push(`defaultOrderBy[${index}] は ["項目名", "ASC" | "DESC", ("FIRST" | "LAST")] で書いてください`);
      continue;
    }
    const [name, direction, nulls] = entry;
    if (!SYSTEM_COLUMNS.includes(name) && !fields.has(name) && name !== config.sortOrderField) issues.push(`defaultOrderBy[${index}] の "${name}" が fields にありません`);
    if (!ORDER_DIRECTIONS.has(direction)) issues.push(`defaultOrderBy[${index}] の向き "${direction}" は ASC か DESC にしてください`);
    if (nulls !== undefined && !NULLS_ORDER.has(nulls)) issues.push(`defaultOrderBy[${index}] の 3 つ目 "${nulls}" は FIRST か LAST にしてください`);
  }

  for (const name of config.tableFields ?? []) {
    if (!columns.has(name)) issues.push(`tableFields "${name}" が fields・relations の fieldName・${SYSTEM_COLUMNS.join(" / ")} にありません`);
  }

  return issues;
}
