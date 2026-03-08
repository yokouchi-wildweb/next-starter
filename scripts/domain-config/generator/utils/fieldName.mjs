import { toCamelCase } from "../../../../src/utils/stringCase.mjs";

/**
 * dbEngine に応じてフィールド名を変換する。
 * - Firestore → camelCase（Firestore 慣例）
 * - Drizzle/Neon → そのまま（snake_case、PostgreSQL 慣例）
 *
 * @param {string} name - domain.json のフィールド名（snake_case）
 * @param {string} dbEngine - "Firestore" | "Neon" | ""
 * @returns {string}
 */
export function resolveFieldName(name, dbEngine) {
  if (dbEngine === "Firestore") {
    return toCamelCase(name) || name;
  }
  return name;
}

/**
 * defaultOrderBy 配列のフィールド名を変換する。
 * 形式: [["field_name", "ASC"], ...] または ["field_name", ...]
 *
 * @param {Array} orderBy
 * @param {string} dbEngine
 * @returns {Array}
 */
export function resolveOrderByFields(orderBy, dbEngine) {
  if (!Array.isArray(orderBy)) return orderBy;
  return orderBy.map((item) => {
    if (Array.isArray(item)) {
      return [resolveFieldName(item[0], dbEngine), ...item.slice(1)];
    }
    return resolveFieldName(item, dbEngine);
  });
}

/**
 * searchFields 配列のフィールド名を変換する。
 *
 * @param {Array<string>} fields
 * @param {string} dbEngine
 * @returns {Array<string>}
 */
export function resolveSearchFields(fields, dbEngine) {
  if (!Array.isArray(fields)) return fields;
  return fields.map((f) => resolveFieldName(f, dbEngine));
}
