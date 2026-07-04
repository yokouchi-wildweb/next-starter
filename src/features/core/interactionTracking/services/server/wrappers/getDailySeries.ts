// src/features/core/interactionTracking/services/server/wrappers/getDailySeries.ts

import { and, asc, eq, gte, lte, sql } from "drizzle-orm";

import { InteractionDailyCounterTable } from "@/features/core/interactionTracking/entities/drizzle";
import type { InteractionDailySeriesPoint } from "@/features/core/interactionTracking/entities/model";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors/domainError";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type GetDailySeriesOptions = {
  /** 取得開始日（YYYY-MM-DD, 含む）。省略時は全期間 */
  from?: string;
  /** 取得終了日（YYYY-MM-DD, 含む）。省略時は全期間 */
  to?: string;
  /** 特定 action のみに絞る場合に指定 */
  action?: string;
};

/**
 * 対象 1 件の日次時系列を取得する（マーケティング分析・チャート用）。
 *
 * データ源は interaction_daily_counters（永久保持・prune の影響を受けない）。
 * shard は合算済み。source 別の内訳行で返すため、導線を問わない日別合計が
 * 必要な場合は呼び出し側で date × action に畳み込むこと。
 *
 * 日付は文字列（YYYY-MM-DD）で受け渡しする
 * （JS Date を sql に渡さない規約 + タイムゾーン起因のずれ防止）。
 */
export async function getDailySeries(
  targetType: string,
  targetId: string,
  options: GetDailySeriesOptions = {},
): Promise<InteractionDailySeriesPoint[]> {
  for (const bound of [options.from, options.to]) {
    if (bound !== undefined && !DATE_PATTERN.test(bound)) {
      throw new DomainError("日付は YYYY-MM-DD 形式で指定してください。", { status: 400 });
    }
  }

  const conditions = [
    eq(InteractionDailyCounterTable.targetType, targetType),
    eq(InteractionDailyCounterTable.targetId, targetId),
  ];
  if (options.from) conditions.push(gte(InteractionDailyCounterTable.date, options.from));
  if (options.to) conditions.push(lte(InteractionDailyCounterTable.date, options.to));
  if (options.action) conditions.push(eq(InteractionDailyCounterTable.action, options.action));

  const rows = await db
    .select({
      date: InteractionDailyCounterTable.date,
      action: InteractionDailyCounterTable.action,
      source: InteractionDailyCounterTable.source,
      total: sql<string>`sum(${InteractionDailyCounterTable.count})`,
    })
    .from(InteractionDailyCounterTable)
    .where(and(...conditions))
    .groupBy(
      InteractionDailyCounterTable.date,
      InteractionDailyCounterTable.action,
      InteractionDailyCounterTable.source,
    )
    .orderBy(asc(InteractionDailyCounterTable.date));

  return rows.map((row) => ({
    date: row.date,
    action: row.action,
    source: row.source,
    count: Number(row.total),
  }));
}
