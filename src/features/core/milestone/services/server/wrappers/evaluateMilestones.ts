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

import { eq, and, sql } from "drizzle-orm";
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
 * tx がある場合、各マイルストーンの評価は SAVEPOINT で分離される。
 * 個別マイルストーンの DB エラーがトランザクション全体を汚染しない。
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

  for (let i = 0; i < definitions.length; i++) {
    const def = definitions[i];
    const savepointName = `milestone_eval_${i}`;

    try {
      // tx がある場合は SAVEPOINT で分離（DB エラー時にトランザクション全体を汚染しない）
      if (tx) {
        await tx.execute(sql.raw(`SAVEPOINT ${savepointName}`));
      }

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

      if (existing.length > 0) {
        if (tx) await tx.execute(sql.raw(`RELEASE SAVEPOINT ${savepointName}`));
        continue;
      }

      // 2. 条件評価（tx を渡してトランザクション内の最新状態を参照可能にする）
      const achieved = await def.evaluate(context, tx);
      if (!achieved) {
        if (tx) await tx.execute(sql.raw(`RELEASE SAVEPOINT ${savepointName}`));
        continue;
      }

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

      if (tx) {
        await tx.execute(sql.raw(`RELEASE SAVEPOINT ${savepointName}`));
      }

      results.push({ key: def.key, achieved: true, metadata });
    } catch (error) {
      // SAVEPOINT へロールバックしてトランザクション状態を回復
      if (tx) {
        try {
          await tx.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${savepointName}`));
        } catch (rollbackError) {
          console.error(`[evaluateMilestones] SAVEPOINT ロールバック失敗:`, rollbackError);
        }
      }
      // 個別マイルストーンのエラーは他の評価をブロックしない
      console.error(`[evaluateMilestones] マイルストーン "${def.key}" の評価中にエラー:`, error);
    }
  }

  return { trigger, results };
}
