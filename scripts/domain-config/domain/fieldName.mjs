// dbEngine に応じたフィールド名の表記。Firestore → camelCase（Firestore 慣例）、Drizzle/Neon → そのまま（snake_case、PostgreSQL 慣例）

import { toCamelCase } from "../../../src/utils/stringCase.mjs";

/**
 * @param {string} name domain.json のフィールド名（snake_case）
 * @param {string} dbEngine "Firestore" | "Neon" | ""
 */
export function resolveFieldName(name, dbEngine) {
  if (dbEngine === "Firestore") {
    return toCamelCase(name) || name;
  }
  return name;
}

/** defaultOrderBy（[["field", "ASC"], ...] または ["field", ...]）のフィールド名を変換する */
export function resolveOrderByFields(orderBy, dbEngine) {
  if (!Array.isArray(orderBy)) return orderBy;
  return orderBy.map((item) => {
    if (Array.isArray(item)) {
      return [resolveFieldName(item[0], dbEngine), ...item.slice(1)];
    }
    return resolveFieldName(item, dbEngine);
  });
}

/** searchFields のフィールド名を変換する */
export function resolveSearchFields(fields, dbEngine) {
  if (!Array.isArray(fields)) return fields;
  return fields.map((f) => resolveFieldName(f, dbEngine));
}
