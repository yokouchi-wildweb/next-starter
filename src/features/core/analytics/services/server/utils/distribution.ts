// src/features/core/analytics/services/server/utils/distribution.ts
// 分布集計の共通ユーティリティ
// boundaries クエリパラメータのパース + バケット振り分け SQL 式の構築

import { sql, type SQL } from "drizzle-orm";
import { MAX_DISTRIBUTION_BOUNDARIES } from "@/features/core/analytics/constants";

/**
 * boundaries パラメータをパースしてバリデーションする
 *
 * 受け入れ条件:
 * - 1〜MAX_DISTRIBUTION_BOUNDARIES 個
 * - すべて正の整数
 * - 昇順かつ重複なし
 *
 * @returns パース済み境界値配列、不正な場合は null
 */
export function parseBoundaries(raw: string): number[] | null {
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0 || parts.length > MAX_DISTRIBUTION_BOUNDARIES) {
    return null;
  }

  const numbers = parts.map(Number);

  if (numbers.some((n) => !Number.isFinite(n) || n <= 0 || !Number.isInteger(n))) {
    return null;
  }

  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] <= numbers[i - 1]) return null;
  }

  return numbers;
}

/**
 * boundaries バリデーションエラーの汎用メッセージ
 */
export const BOUNDARIES_ERROR_MESSAGE =
  "boundaries は正の整数のカンマ区切り（昇順、最大20個）で指定してください。";

/**
 * CASE WHEN 式で値をバケットに振り分ける SQL 式を構築する
 *
 * boundaries=[1, 30, 100] の場合:
 *   value >= 100 → 100
 *   value >= 30  → 30
 *   value >= 1   → 1
 *   else         → 0
 *
 * @param valueExpr バケット振り分け対象の数値カラム/SQL式
 * @param boundaries 昇順の正整数配列（parseBoundaries の戻り値を想定）
 */
export function buildBucketExpr(
  valueExpr: SQL.Aliased<number> | SQL<number>,
  boundaries: number[],
): SQL {
  const desc = [...boundaries].sort((a, b) => b - a);
  const whenClauses = desc.map(
    (b) => sql`WHEN ${valueExpr} >= ${b} THEN ${b}`,
  );
  return sql`CASE ${sql.join(whenClauses, sql` `)} ELSE 0 END`;
}
