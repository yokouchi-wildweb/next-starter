// src/lib/crud/drizzle/service/helpers.ts
// 値の比較・id の解決・リレーション展開の深さ(サービスの群が共有する純粋な小道具)


export const resolveRecordId = (value: unknown): string | number | undefined => {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  return undefined;
};

/**
 * replaceByQuery のスコープガード用の値比較。
 * where の eq 値は HTTP 経由だと JSON 由来（Date は ISO 文字列、数値/文字列の揺れあり）、
 * record 側は Zod parse 済みの型付き値のため、型を正規化してから比較する。
 */
export const isSameScopeValue = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a == null || b == null) return false;
  const normalize = (v: unknown): unknown =>
    v instanceof Date
      ? v.toISOString()
      : typeof v === "number" || typeof v === "boolean"
        ? String(v)
        : v;
  return normalize(a) === normalize(b);
};

/**
 * withRelations オプションから展開する深さを解決する。
 * - false/undefined: 0（展開しない）
 * - true/1: 1階層
 * - 2: 2階層（リレーション先のリレーションも展開）
 */
const MAX_RELATION_DEPTH = 3;

export const resolveRelationDepth = (withRelations?: boolean | number): number => {
  if (withRelations === true) return 1;
  if (typeof withRelations === "number" && withRelations > 0) return Math.min(withRelations, MAX_RELATION_DEPTH);
  return 0;
};
