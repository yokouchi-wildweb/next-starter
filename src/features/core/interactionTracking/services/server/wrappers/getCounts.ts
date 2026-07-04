// src/features/core/interactionTracking/services/server/wrappers/getCounts.ts

import { and, eq, inArray, sql } from "drizzle-orm";

import { InteractionCounterTable } from "@/features/core/interactionTracking/entities/drizzle";
import type {
  InteractionCounts,
  InteractionCountsBulk,
} from "@/features/core/interactionTracking/entities/model";
import { db } from "@/lib/drizzle";

/**
 * 対象 1 件の集計カウントを取得する（shard を SUM した合計値）。
 *
 * 読み取りは常に interaction_counters 側を使う。イベント明細（interaction_events）は
 * retention pruning で削除されるが、カウンタは prune 対象外のため合計値は狂わない。
 *
 * @returns action → 合計カウント の Map（記録が無い action はキー自体が存在しない）
 */
export async function getCounts(
  targetType: string,
  targetId: string,
): Promise<InteractionCounts> {
  const rows = await db
    .select({
      action: InteractionCounterTable.action,
      total: sql<string>`sum(${InteractionCounterTable.count})`,
    })
    .from(InteractionCounterTable)
    .where(
      and(
        eq(InteractionCounterTable.targetType, targetType),
        eq(InteractionCounterTable.targetId, targetId),
      ),
    )
    .groupBy(InteractionCounterTable.action);

  const counts: InteractionCounts = new Map();
  for (const row of rows) {
    counts.set(row.action, Number(row.total));
  }
  return counts;
}

/**
 * 複数対象の集計カウントを 1 クエリでまとめて取得する（管理一覧のカラム表示用）。
 *
 * @returns targetId → (action → 合計カウント) の Map。
 *          記録が無い targetId はキー自体が存在しない（呼び出し側で 0 フォールバック）
 */
export async function getCountsBulk(
  targetType: string,
  targetIds: string[],
): Promise<InteractionCountsBulk> {
  const result: InteractionCountsBulk = new Map();
  if (targetIds.length === 0) return result;

  const rows = await db
    .select({
      targetId: InteractionCounterTable.targetId,
      action: InteractionCounterTable.action,
      total: sql<string>`sum(${InteractionCounterTable.count})`,
    })
    .from(InteractionCounterTable)
    .where(
      and(
        eq(InteractionCounterTable.targetType, targetType),
        inArray(InteractionCounterTable.targetId, targetIds),
      ),
    )
    .groupBy(InteractionCounterTable.targetId, InteractionCounterTable.action);

  for (const row of rows) {
    let counts = result.get(row.targetId);
    if (!counts) {
      counts = new Map();
      result.set(row.targetId, counts);
    }
    counts.set(row.action, Number(row.total));
  }
  return result;
}
