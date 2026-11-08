// シリーズの進み具合(利用者がどの段まで達成したか・次の段・残りの段の数)
//
// 今の stages() と milestones の記録から組む(消した段階の記録は出ない)。数の残り(次の段まであと何円など)は
// 段階ごとに意味が違うので持たない(段階の値から項目の側で計算する)。
//
// 使い方(server):
// ```ts
// const progress = await getMilestoneSeriesProgress(userId, "rank_up");
// const current = progress?.achievedKeys.at(-1) ?? null;   // sequential なら一番上の達成済みの段
// const next = progress?.next ?? null;
// ```

import { and, eq, inArray } from "drizzle-orm";

import { db, type TransactionClient } from "@/lib/drizzle";
import { MilestoneTable } from "@/features/core/milestone/entities/drizzle";

import { getMilestoneSeries } from "../milestoneRegistry";
import type { MilestoneSeriesProgress } from "../../../types/milestone";

/**
 * @param userId 利用者
 * @param seriesKey シリーズの鍵
 * @param tx トランザクション(任意。tx の中の最新の記録を読む)
 * @returns 進み具合。シリーズが無ければ null
 */
export async function getMilestoneSeriesProgress(
  userId: string,
  seriesKey: string,
  tx?: TransactionClient,
): Promise<MilestoneSeriesProgress | null> {
  const series = getMilestoneSeries(seriesKey);
  if (!series) return null;

  const stageKeys = series.stages().map((stage) => series.stageKey(stage));
  const rows =
    stageKeys.length === 0
      ? []
      : await (tx ?? db)
          .select({ key: MilestoneTable.milestone_key, achievedAt: MilestoneTable.achieved_at })
          .from(MilestoneTable)
          .where(and(eq(MilestoneTable.user_id, userId), inArray(MilestoneTable.milestone_key, stageKeys)));
  const achievedAt = new Map(rows.map((row) => [row.key, row.achievedAt]));

  const stages = stageKeys.map((stageKey, index) => ({
    stageKey,
    index,
    achieved: achievedAt.has(stageKey),
    achievedAt: achievedAt.get(stageKey) ?? null,
  }));
  const pending = stages.filter((stage) => !stage.achieved);
  return {
    seriesKey,
    order: series.order,
    stages,
    achievedKeys: stages.filter((stage) => stage.achieved).map((stage) => stage.stageKey),
    next: pending[0]?.stageKey ?? null,
    remaining: pending.length,
  };
}
