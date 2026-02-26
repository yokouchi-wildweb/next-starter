// src/features/core/analytics/services/server/utils/aggregation.ts
// 集計ユーティリティ

/**
 * 変化率を計算する（0除算対応）
 */
export function changeRate(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}
