// 検査: 一覧・検索の設定（searchFields・defaultOrderBy・tableFields）と複合ユニーク（compositeUniques）。
// 無い項目名は生成物で `table.<名>` になり tsc で落ちる / 一覧で空の列になる。文字列でない列の検索は ilike で落ち、
// Firestore の複合ユニークは黙って捨てられるので、生成前に止める。
// 規則の正: src/features/README.md「domain.json スキーマ定義」（searchFields / defaultOrderBy / tableFields / compositeUniques）

import { fieldTypeSpec } from "../spec/fieldTypes.mjs";

const SYSTEM_COLUMNS = ["id", "createdAt", "updatedAt"];
const ORDER_DIRECTIONS = new Set(["ASC", "DESC"]);
const NULLS_ORDER = new Set(["FIRST", "LAST"]);

/** 検索できる型 = 列が text の型（ilike で比べる） */
const isSearchable = (field) => fieldTypeSpec(field.fieldType).column === "text";

/**
 * 止めない警告: searchFields の文字列でない列（ilike は enum・boolean・uuid の列に使えないはず。実行時は未確認なので止めない）
 * @param {object} config domain.json
 * @returns {string[]}
 */
export function viewConfigWarnings(config) {
  const fields = new Map((config.fields ?? []).filter((f) => typeof f?.name === "string").map((f) => [f.name, f]));
  return (config.searchFields ?? [])
    .filter((name) => fields.has(name) && !isSearchable(fields.get(name)))
    .map((name) => `searchFields "${name}" は文字列の列ではありません（fieldType "${fields.get(name).fieldType}"）。キーワード検索で失敗するおそれがあります`);
}

/**
 * @param {object} config domain.json
 * @returns {string[]} 問題（空なら無し）
 */
export function viewConfigIssues(config) {
  const issues = [];
  const fields = new Map((config.fields ?? []).filter((f) => typeof f?.name === "string").map((f) => [f.name, f]));
  const relationKeys = (config.relations ?? []).filter((r) => typeof r?.fieldName === "string").map((r) => r.fieldName);
  const belongsToKeys = (config.relations ?? []).filter((r) => r?.relationType === "belongsTo" && typeof r?.fieldName === "string").map((r) => r.fieldName);
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

  const uniques = config.compositeUniques ?? [];
  if (config.dbEngine === "Firestore" && uniques.length > 0) {
    issues.push("Firestore のドメインでは compositeUniques を使えません（制約が作られません）");
  } else {
    const uniqueColumns = new Set([...fields.keys(), ...belongsToKeys]);
    uniques.forEach((names, index) => {
      if (!Array.isArray(names) || names.length === 0) {
        issues.push(`compositeUniques[${index}] は 1 つ以上の項目名の配列にしてください`);
        return;
      }
      for (const name of names) {
        if (!uniqueColumns.has(name)) issues.push(`compositeUniques[${index}] の "${name}" が fields・belongsTo の fieldName にありません`);
      }
    });
  }
  return issues;
}
