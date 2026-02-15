// マイルストーン評価エンジン
//
// トリガー発生時に呼び出され、登録済みマイルストーンを評価する。
// 未達成かつ条件を満たしたマイルストーンを記録し、onAchieved コールバックを実行する。
//
// 使い方:
// ```ts
// await evaluateMilestones("purchase_completed", {
//   userId,
//   payload: { purchaseRequest },
// }, tx);
// ```

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import type { TransactionClient } from "@/lib/drizzle/transaction";
import { MilestoneTable } from "@/features/core/milestone/entities/drizzle";
import { getMilestonesByTrigger } from "../milestoneRegistry";
import type {
  MilestoneEventContext,
  MilestoneEvaluationResult,
  EvaluateMilestonesResult,
} from "../../../types/milestone";

// definitions の副作用インポート（登録を実行）
import "../definitions";

/**
 * マイルストーンを評価する
 *
 * 指定トリガーに紐づく全マイルストーンを評価し、
 * 未達成かつ条件を満たしたものを記録する。
 *
 * @param trigger トリガー名（例: "purchase_completed"）
 * @param params userId と payload
 * @param tx トランザクション（オプション。購入完了など既存トランザクション内から呼ぶ場合に渡す）
 * @returns 評価結果
 */
export async function evaluateMilestones(
  trigger: string,
  params: { userId: string; payload: Record<string, unknown> },
  tx?: TransactionClient,
): Promise<EvaluateMilestonesResult> {
  const definitions = getMilestonesByTrigger(trigger);
  if (definitions.length === 0) {
    return { trigger, results: [] };
  }

  const context: MilestoneEventContext = {
    userId: params.userId,
    trigger,
    payload: params.payload,
  };

  const executor = tx ?? db;
  const results: MilestoneEvaluationResult[] = [];

  for (const def of definitions) {
    try {
      // 1. 既に達成済み？ → スキップ
      const existing = await executor
        .select({ id: MilestoneTable.id })
        .from(MilestoneTable)
        .where(
          and(
            eq(MilestoneTable.user_id, context.userId),
            eq(MilestoneTable.milestone_key, def.key),
          ),
        )
        .limit(1);

      if (existing.length > 0) continue;

      // 2. 条件評価
      const achieved = await def.evaluate(context);
      if (!achieved) continue;

      // 3. 達成 → コールバック実行 → 記録
      const metadata = await def.onAchieved?.({
        userId: context.userId,
        milestoneKey: def.key,
        context,
        tx,
      });

      await executor.insert(MilestoneTable).values({
        user_id: context.userId,
        milestone_key: def.key,
        achieved_at: new Date(),
        metadata: metadata ?? null,
      });

      results.push({ key: def.key, achieved: true, metadata });
    } catch (error) {
      // 個別マイルストーンのエラーは他の評価をブロックしない
      console.error(`[evaluateMilestones] マイルストーン "${def.key}" の評価中にエラー:`, error);
    }
  }

  return { trigger, results };
}
