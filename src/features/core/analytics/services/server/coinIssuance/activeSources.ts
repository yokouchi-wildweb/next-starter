// src/features/core/analytics/services/server/coinIssuance/activeSources.ts
// 有効なソースだけに絞る(機能が無効ならテーブルが無い場合があるため、そのソースは走らせない)

import type { CoinIssuanceSource } from "./types";

// key の重複は例外(レスポンスの JSON のキーになる)
export const activeCoinIssuanceSources = (sources: readonly CoinIssuanceSource[]): CoinIssuanceSource[] => {
  const seen = new Set<string>();
  for (const { key } of sources) {
    if (seen.has(key)) throw new Error(`コイン創出ソース "${key}" が複数あります`);
    seen.add(key);
  }
  return sources.filter((source) => source.enabled?.() ?? true);
};
