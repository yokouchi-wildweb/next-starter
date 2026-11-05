// src/features/core/analytics/services/server/coinIssuance/reasonKeyBreakdown.ts
// 付与の種類(reason_key)ごとの集計の行を、ソースの結果(合計 + 表示だけの内訳)にする。
// 合計 = 行の和。label = 種類の項目の label(未登録の key は key のまま、null は「未分類」)。並び = sortOrder → key、未分類は最後

// 種類の引き方は呼び手が渡す(walletHistory は wallet の門で閉じる。呼び手 = wallet で閉じる wallet_bonus_grant)

import type { CoinIssuanceBreakdownRow, CoinIssuanceSourceResult } from "./types";

/** 種類の無い行の表示名 */
export const UNKEYED_BREAKDOWN_LABEL = "未分類";

export function toReasonKeyBreakdown(
  rows: ReadonlyArray<{ key: string | null; current: number | string; previous: number | string }>,
  lookup: (key: string) => { label: string; sortOrder?: number } | undefined,
): CoinIssuanceSourceResult {
  const breakdown: CoinIssuanceBreakdownRow[] = rows.map((row) => ({
    key: row.key,
    label: row.key === null ? UNKEYED_BREAKDOWN_LABEL : (lookup(row.key)?.label ?? row.key),
    current: Number(row.current),
    previous: Number(row.previous),
  }));
  const order = (row: CoinIssuanceBreakdownRow) =>
    row.key === null ? Number.POSITIVE_INFINITY : (lookup(row.key)?.sortOrder ?? 0);
  breakdown.sort((a, b) => order(a) - order(b) || String(a.key).localeCompare(String(b.key)));
  return {
    current: breakdown.reduce((sum, row) => sum + row.current, 0),
    previous: breakdown.reduce((sum, row) => sum + row.previous, 0),
    breakdown,
  };
}
