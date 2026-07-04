// src/features/core/interactionTracking/services/server/wrappers/record.ts

import { sql } from "drizzle-orm";

import { INTERACTION_TRACKING_CONFIG } from "@/config/app/interaction-tracking.config";
import {
  InteractionCounterTable,
  InteractionDailyCounterTable,
  InteractionEventTable,
} from "@/features/core/interactionTracking/entities/drizzle";
import { db } from "@/lib/drizzle";
import type { TransactionClient } from "@/lib/drizzle/transaction";
import { DomainError } from "@/lib/errors/domainError";

export type RecordInteractionInput = {
  /** 対象種別（例: "bulletin"）。語彙の採番は消費側ドメインの責務 */
  targetType: string;
  /** 対象 ID。対象テーブルの PK を文字列化したもの */
  targetId: string;
  /** アクション（例: "click", "link_click"） */
  action: string;
  /** 発生箇所（例: "home" | "list" | "deep_link"）。省略可 */
  source?: string | null;
  /** ログインユーザーの ID。匿名は null / 省略 */
  userId?: string | null;
  /** 任意メタデータ（サーバー内部専用。公開 ingest からは渡らない） */
  metadata?: Record<string, unknown> | null;
  /** イベント明細の保持日数。省略時は INTERACTION_TRACKING_CONFIG.defaultRetentionDays */
  retentionDays?: number;
  /**
   * イベント明細（interaction_events）を記録するか。既定 true。
   * false にすると集計（累計 + 日次）のみ加算する（2書き込み）。
   * 「誰が」の情報が不要で流量の多い用途向け。false の場合 userId / metadata は破棄される
   */
  recordDetail?: boolean;
  /** 呼び出し側トランザクションに合流させたい場合に渡す（ロールバック整合） */
  tx?: TransactionClient;
};

/**
 * インタラクションを 1 件記録する
 * （イベント明細の追記 + 累計カウンタ・日次集計カウンタの原子加算）。
 *
 * - 3 つの書き込みは同一トランザクションで実行し、明細と集計の整合を保つ
 *   （集計はバッチではなく発生時にその場で完成する。明細の prune に依存しない）
 * - カウンタ加算は単一文の INSERT ... ON CONFLICT DO UPDATE（行レベルロックのみ・
 *   read-modify-write レース無し）。shard をランダムに選ぶことでホットターゲットでも
 *   ロック競合が単一行に集中しない
 * - 時刻は SQL 側の now() で発行する（JS Date を sql に直接渡さない / 原子性確保）。
 *   日次集計の日付も SQL 側で aggregationTimeZone に変換して算出する
 *
 * セキュリティ: 本メソッドはサーバー内部専用。クライアントからの経路は
 * 公開 ingest ルート（POST /api/interactions）のみとし、そこでは
 * interactionTargetRegistry による fail-closed 検証を必ず通すこと（カウント水増し防止）。
 */
export async function record(input: RecordInteractionInput): Promise<void> {
  const targetType = input.targetType?.trim();
  const targetId = input.targetId?.trim();
  const action = input.action?.trim();
  if (!targetType || !targetId || !action) {
    throw new DomainError("targetType / targetId / action は必須です。", { status: 400 });
  }

  const retentionDays =
    input.retentionDays ?? INTERACTION_TRACKING_CONFIG.defaultRetentionDays;
  if (!Number.isInteger(retentionDays) || retentionDays <= 0) {
    throw new DomainError("保持日数は正の整数で指定してください。", { status: 400 });
  }

  const shardCount = Math.max(1, INTERACTION_TRACKING_CONFIG.counterShardCount);
  const shard = Math.floor(Math.random() * shardCount);
  const source = input.source?.trim() || null;
  const timeZone = INTERACTION_TRACKING_CONFIG.aggregationTimeZone;
  const recordDetail = input.recordDetail ?? true;

  const run = async (executor: TransactionClient) => {
    if (recordDetail) {
      await executor.insert(InteractionEventTable).values({
        targetType,
        targetId,
        action,
        source,
        userId: input.userId ?? null,
        metadata: input.metadata ?? null,
        retentionDays,
      });
    }

    await executor
      .insert(InteractionCounterTable)
      .values({
        targetType,
        targetId,
        action,
        shard,
        count: 1,
        firstOccurredAt: sql`now()`,
        lastOccurredAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: [
          InteractionCounterTable.targetType,
          InteractionCounterTable.targetId,
          InteractionCounterTable.action,
          InteractionCounterTable.shard,
        ],
        set: {
          count: sql`${InteractionCounterTable.count} + 1`,
          lastOccurredAt: sql`now()`,
        },
      });

    // 日次集計（永久保持）。日付は DB 側で日界タイムゾーンに変換して算出する。
    // source 未指定は '' に正規化（UNIQUE の NULL 重複問題を避ける）
    await executor
      .insert(InteractionDailyCounterTable)
      .values({
        date: sql`(now() at time zone ${timeZone})::date`,
        targetType,
        targetId,
        action,
        source: source ?? "",
        shard,
        count: 1,
      })
      .onConflictDoUpdate({
        target: [
          InteractionDailyCounterTable.date,
          InteractionDailyCounterTable.targetType,
          InteractionDailyCounterTable.targetId,
          InteractionDailyCounterTable.action,
          InteractionDailyCounterTable.source,
          InteractionDailyCounterTable.shard,
        ],
        set: {
          count: sql`${InteractionDailyCounterTable.count} + 1`,
        },
      });
  };

  if (input.tx) {
    await run(input.tx);
  } else {
    await db.transaction(run);
  }
}
