// src/features/core/analytics/services/server/coinIssuance/activeSources.ts
// 有効なソースだけに絞る(機能が無効ならテーブルが無い場合があるため、そのソースは走らせない)

import type { CoinIssuanceSource } from "./types";

export const activeCoinIssuanceSources = (sources: readonly CoinIssuanceSource[]): CoinIssuanceSource[] =>
  sources.filter((source) => source.enabled?.() ?? true);
