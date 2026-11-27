// src/lib/domain/junction/links.mjs
// 多対多の結びの登録(D354)の 2 本の結びの読み方: 生成器・検査(scripts)とデータの移し(src)が同じ 1 つを読む。名前を組み立てない(through が名指す登録の宣言だけを読む)。
// 結び = 結びの登録の belongsTo(列 = fieldName、指す登録 = domain)か、手の表の形の 1 列の foreignKeys(列 = columns[0]、指す登録 = references.table の表の登録)。
// 素の JS(ファイルを開かない純関数)。scripts からは相対で node.mjs、src からは @/lib/domain

import { toCamelCase, toSnakeCase } from "../../stringCase/index.mjs";

/**
 * 結びの登録の宣言のうち、ここが読む鍵
 * @typedef {{
 *   relations?: { relationType?: string, fieldName?: string, domain?: string, required?: boolean }[],
 *   foreignKeys?: { columns?: string[], references?: { table?: string } }[],
 * }} JunctionDeclaration
 */

/**
 * 登録の物理の表の名前(entity.json の table、無ければ snake(plural)、無ければ snake(登録名))
 * @param {string} name 登録名
 * @param {{ table?: unknown, plural?: unknown } | null | undefined} config
 * @returns {string}
 */
export function registrationTableName(name, config) {
  if (typeof config?.table === "string") return config.table;
  return toSnakeCase(typeof config?.plural === "string" && config.plural.length > 0 ? config.plural : name);
}

/**
 * 結びの登録が持つ結び
 * @param {object | null | undefined} junction 結びの登録の entity.json(読む鍵は JunctionDeclaration)
 * @param {(table: string) => string | null} registrationOfTable 物理の表の名前 → 登録名(camelCase。知らなければ null)
 * @returns {{ column: string, target: string | null, required: boolean }[]} target = 指す登録名(camelCase)
 */
export function junctionLinksOf(junction, registrationOfTable) {
  const declaration = /** @type {JunctionDeclaration} */ (junction ?? {});
  const links = [];
  for (const relation of declaration.relations ?? []) {
    if (relation?.relationType !== "belongsTo") continue;
    links.push({ column: relation.fieldName ?? "", target: toCamelCase(relation.domain ?? ""), required: relation.required === true });
  }
  for (const foreignKey of declaration.foreignKeys ?? []) {
    const columns = foreignKey?.columns ?? [];
    if (columns.length !== 1) continue;
    links.push({ column: columns[0], target: registrationOfTable(foreignKey.references?.table ?? "") ?? null, required: true });
  }
  return links;
}

/**
 * 持つ側と相手を指す列(結びの表の TS の名前)。自分自身への多対多は 1 本目が持つ側、2 本目が相手
 * @param {object | null | undefined} junction 結びの登録の entity.json(読む鍵は JunctionDeclaration)
 * @param {string} owner 持つ側の登録名(camelCase)
 * @param {string} target 相手の登録名(camelCase)
 * @param {(table: string) => string | null} registrationOfTable
 * @returns {{ sourceColumn: string, targetColumn: string } | null} 2 本が揃わなければ null
 */
export function junctionColumnsOf(junction, owner, target, registrationOfTable) {
  const links = junctionLinksOf(junction, registrationOfTable);
  const source = links.find((link) => link.target === owner);
  const other = links.find((link) => link !== source && link.target === target);
  return source && other ? { sourceColumn: source.column, targetColumn: other.column } : null;
}
