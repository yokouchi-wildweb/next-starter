// src/lib/crud/searchLimit.ts
// 外(HTTP の要求など)から来る search の limit に既定と上限を当てる。server の search は limit を型で必須にしている
// (BoundedSearchParams)ので、client の任意の limit はここで解いてから渡す。

import { DomainError } from "@/lib/errors";

/** HTTP の search の既定の件数(今までの search の既定と同じ) */
export const DEFAULT_SEARCH_LIMIT = 100;
/** HTTP の search の上限(覚える値の大きさの手引きの上限と同じ。超えれば 400) */
export const MAX_SEARCH_LIMIT = 1000;

export type ResolveSearchLimitOptions = {
  /** limit が無い時の件数(既定 DEFAULT_SEARCH_LIMIT) */
  fallback?: number;
  /** 受ける上限(既定 MAX_SEARCH_LIMIT) */
  max?: number;
};

/**
 * limit が無ければ fallback、上限を超えれば DomainError(400)。黙って切り詰めない(頼んだ件数より少なく返すと、
 * 呼び手は残りが無いと読み違える)。正の整数かは呼び手の parse が見る(ここは数の範囲だけ)
 */
export function resolveSearchLimit(limit: number | undefined, options: ResolveSearchLimitOptions = {}): number {
  const fallback = options.fallback ?? DEFAULT_SEARCH_LIMIT;
  const max = options.max ?? MAX_SEARCH_LIMIT;
  if (limit === undefined) return fallback;
  if (!Number.isInteger(limit) || limit <= 0) throw new DomainError("limit は正の整数で指定してください", { status: 400 });
  if (limit > max) throw new DomainError(`limit は ${max} 以下で指定してください`, { status: 400 });
  return limit;
}
