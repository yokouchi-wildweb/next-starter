// src/lib/crud/drizzle/query/searchRankSpec.ts
//
// searchRank パラメータの正規化（純粋関数・drizzle 非依存・ランタイム import なし）。
// SQL 生成は buildSearchRank.ts が担当し、ここは「どのフィールドをどの重みで採点するか」の
// 解決のみを行う。テストは searchRank.test.mjs（pnpm test:crud-search-rank）。
// NOTE: node --test から .ts を直接読むため、ランタイム import（相対パス）を持たないこと。

import type { SearchRankField, SearchRankSpec } from "../../types";

export type NormalizedSearchRankField = { field: string; weight: number };

/**
 * SearchRankField を {field, weight} に揃える。
 * weight が有限の正数でないものは採点に寄与できないため除外する（fail-closed）。
 */
function toNormalizedField(entry: SearchRankField): NormalizedSearchRankField | undefined {
  if (typeof entry === "string") {
    const field = entry.trim();
    return field ? { field, weight: 1 } : undefined;
  }
  if (!entry || typeof entry !== "object" || typeof entry.field !== "string") return undefined;
  const field = entry.field.trim();
  if (!field) return undefined;
  const weight = entry.weight === undefined ? 1 : entry.weight;
  if (typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0) return undefined;
  return { field, weight };
}

/**
 * searchRank パラメータとサービス既定値から採点対象フィールドを解決する。
 *
 * 解決順: 呼び出し側 spec.fields → serviceDefault.fields → searchFields（等重み）
 * 制約: searchFields に含まれないフィールドは除外（WHERE に参加しない列で並び替えない）。
 *       重複は先勝ち。
 *
 * @returns 採点対象。空配列 = ランキング無効（従来の並び順にフォールバック）
 */
export function normalizeSearchRankSpec(
  searchRank: boolean | SearchRankSpec | undefined,
  searchFields: string[] | undefined,
  serviceDefault?: SearchRankSpec,
): NormalizedSearchRankField[] {
  if (!searchRank) return [];
  if (!searchFields || searchFields.length === 0) return [];

  const specFields: SearchRankField[] | undefined =
    typeof searchRank === "object" && Array.isArray(searchRank.fields) && searchRank.fields.length
      ? searchRank.fields
      : serviceDefault?.fields && serviceDefault.fields.length
        ? serviceDefault.fields
        : searchFields;

  const allowed = new Set(searchFields);
  const seen = new Set<string>();
  const result: NormalizedSearchRankField[] = [];
  for (const entry of specFields) {
    const normalized = toNormalizedField(entry);
    if (!normalized) continue;
    if (!allowed.has(normalized.field)) continue;
    if (seen.has(normalized.field)) continue;
    seen.add(normalized.field);
    result.push(normalized);
  }
  return result;
}
