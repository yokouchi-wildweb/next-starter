// マイルストーン評価エンジン
//
// トリガー発生時に呼び出され、登録済みマイルストーン(読み手がシリーズを段階ごとに展開した一覧)を評価する。
// 未達成かつ条件を満たしたマイルストーンを記録し、onAchieved コールバックを実行する。
//
// 順(1 件ごと、二重の付与を防ぐ):
//   1. evaluate(tx の中の最新を読める)
//   2. 記録を確定: insert … on conflict (user_id, milestone_key) do nothing returning。行が返らなければ
//      並走が先に記録した = onAchieved を呼ばず結果にも出さない
//   3. onAchieved(記録と同じ tx)→ 戻り値を metadata に update
//   tx があるときは 1 件ごとに SAVEPOINT、無いときは 1 件ごとに db.transaction。onAchieved が投げると記録も戻る
//
// シリーズ(order):
//   - sequential: 段階の並び順に評価する。段階が達成したら、その下の未達成の段を下から順に先に達成させる
//     (onAchieved の params.series.viaHigherStage = true。付与を省くかは項目が決める)
//   - unordered と普通の定義: 各々独立に評価する(今までと同じ)
// context.achievedInThisEvaluation で、この評価で先に達成した鍵を後の定義・段階に渡す。
//
// 使い方:
// ```ts
// await evaluateMilestones("purchase_completed", {
//   userId,
//   payload: { purchaseRequest },
// }, tx);
// ```

import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import type { TransactionClient } from "@/lib/drizzle";
import { MilestoneTable } from "@/features/core/milestone/entities/drizzle";
import { getMilestonesByTrigger } from "../milestoneRegistry";
import type {
  MilestoneAchievedParams,
  MilestoneDefinition,
  MilestoneEventContext,
  MilestoneEvaluationResult,
  EvaluateMilestonesResult,
} from "../../../types/milestone";

/** 評価のまとまり: 普通の定義(unordered の段階を含む)1 つ、または sequential のシリーズの段階の並び */
type EvaluationGroup =
  | { kind: "single"; definition: MilestoneDefinition }
  | { kind: "sequential"; seriesKey: string; stages: MilestoneDefinition[] };

/** 読み手の並び(シリーズの段階は続けて並ぶ)を、sequential のシリーズごとにまとめる */
function groupDefinitions(definitions: MilestoneDefinition[]): EvaluationGroup[] {
  const groups: EvaluationGroup[] = [];
  for (const definition of definitions) {
    const series = definition.series;
    if (series?.order !== "sequential") {
      groups.push({ kind: "single", definition });
      continue;
    }
    const last = groups[groups.length - 1];
    if (last?.kind === "sequential" && last.seriesKey === series.seriesKey) {
      last.stages.push(definition);
    } else {
      groups.push({ kind: "sequential", seriesKey: series.seriesKey, stages: [definition] });
    }
  }
  return groups;
}

/**
 * マイルストーンを評価する
 *
 * 指定トリガーに紐づく全マイルストーンを評価し、
 * 未達成かつ条件を満たしたものを記録してから onAchieved を呼ぶ。
 *
 * tx がある場合、各マイルストーンの評価・記録は SAVEPOINT で分離される。
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

  const achievedInThisEvaluation = new Set<string>();
  const context: MilestoneEventContext = {
    userId: params.userId,
    trigger,
    payload: params.payload,
    achievedInThisEvaluation,
  };

  const executor = tx ?? db;
  const results: MilestoneEvaluationResult[] = [];

  // 達成済みマイルストーンを1クエリで一括取得
  const allKeys = definitions.map((d) => d.key);
  const achievedRows = await executor
    .select({ milestone_key: MilestoneTable.milestone_key })
    .from(MilestoneTable)
    .where(
      and(
        eq(MilestoneTable.user_id, context.userId),
        inArray(MilestoneTable.milestone_key, allKeys),
      ),
    );
  const achievedKeys = new Set(achievedRows.map((r) => r.milestone_key));

  let savepointSeq = 0;

  /** tx があれば SAVEPOINT、無ければ db.transaction の中で run する。失敗は戻して投げ直す */
  const isolated = async <T>(run: (inner: TransactionClient | undefined) => Promise<T>): Promise<T> => {
    if (!tx) return db.transaction(async (inner) => run(inner));
    const name = `milestone_eval_${savepointSeq++}`;
    await tx.execute(sql.raw(`SAVEPOINT ${name}`));
    try {
      const value = await run(tx);
      await tx.execute(sql.raw(`RELEASE SAVEPOINT ${name}`));
      return value;
    } catch (error) {
      try {
        await tx.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${name}`));
      } catch (rollbackError) {
        console.error(`[evaluateMilestones] SAVEPOINT ロールバック失敗:`, rollbackError);
      }
      throw error;
    }
  };

  /** 条件の評価(tx がある時は SAVEPOINT の中)。投げたら false 扱いにしてログ */
  const evaluate = async (definition: MilestoneDefinition): Promise<boolean> => {
    try {
      return await isolatedEvaluate(definition);
    } catch (error) {
      console.error(`[evaluateMilestones] マイルストーン "${definition.key}" の評価中にエラー:`, error);
      return false;
    }
  };
  const isolatedEvaluate = (definition: MilestoneDefinition) =>
    tx ? isolated(() => definition.evaluate(context, tx)) : definition.evaluate(context, undefined);

  /** 記録を確定してから onAchieved。記録が並走に取られていたら null。失敗は戻してログ(他を止めない) */
  const achieve = async (
    definition: MilestoneDefinition,
    series?: MilestoneAchievedParams["series"],
  ): Promise<boolean> => {
    try {
      const outcome = await isolated(async (inner) => {
        const writer = inner ?? executor;
        const inserted = await writer
          .insert(MilestoneTable)
          .values({ user_id: context.userId, milestone_key: definition.key, achieved_at: new Date(), metadata: null })
          .onConflictDoNothing({ target: [MilestoneTable.user_id, MilestoneTable.milestone_key] })
          .returning({ id: MilestoneTable.id });
        const row = inserted[0];
        if (!row) return null;
        const metadata = await definition.onAchieved?.({
          userId: context.userId,
          milestoneKey: definition.key,
          context,
          tx: inner,
          ...(series ? { series } : {}),
        });
        if (metadata) {
          await writer.update(MilestoneTable).set({ metadata }).where(eq(MilestoneTable.id, row.id));
        }
        return { metadata };
      });
      if (!outcome) return false;
      achievedKeys.add(definition.key);
      achievedInThisEvaluation.add(definition.key);
      results.push({ key: definition.key, achieved: true, metadata: outcome.metadata });
      return true;
    } catch (error) {
      // 個別マイルストーンのエラーは他の評価をブロックしない
      console.error(`[evaluateMilestones] マイルストーン "${definition.key}" の評価中にエラー:`, error);
      return false;
    }
  };

  for (const group of groupDefinitions(definitions)) {
    if (group.kind === "single") {
      const definition = group.definition;
      // 達成済み → スキップ（DBアクセス不要）
      if (achievedKeys.has(definition.key)) continue;
      if (!(await evaluate(definition))) continue;
      const marker = definition.series;
      await achieve(
        definition,
        marker ? { ...marker, reachedStageKey: marker.stageKey, viaHigherStage: false } : undefined,
      );
      continue;
    }

    // sequential: 並び順に評価し、達成した段の下に未達成の段が残っていれば下から先に達成させる
    for (let i = 0; i < group.stages.length; i++) {
      const stage = group.stages[i];
      if (achievedKeys.has(stage.key)) continue;
      if (!(await evaluate(stage))) continue;
      const reached = stage.series!;
      for (let j = 0; j < i; j++) {
        const lower = group.stages[j];
        if (achievedKeys.has(lower.key)) continue;
        await achieve(lower, { ...lower.series!, reachedStageKey: reached.stageKey, viaHigherStage: true });
      }
      await achieve(stage, { ...reached, reachedStageKey: reached.stageKey, viaHigherStage: false });
    }
  }

  return { trigger, results };
}
