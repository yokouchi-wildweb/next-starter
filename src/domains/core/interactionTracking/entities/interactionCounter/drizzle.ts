// src/domains/core/interactionTracking/entities/interactionCounter/drizzle.ts

import { bigint, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * インタラクション集計カウンタテーブル（シャーディング付き）。
 *
 * - 単位は (target_type, target_id, action, shard)。読み取りは shard を SUM して合計する。
 * - shard はホットカウンタの行ロック競合対策。人気ターゲットへの同時クリックが
 *   単一行で直列化しないよう、書き込み時にランダムな shard 行へ分散させる
 *   （競合が理論上 1/N になる）。shard 数は interactionTrackingConfig.counterShardCount。
 * - 加算は単一文の INSERT ... ON CONFLICT DO UPDATE（原子的・read-modify-write レース無し）。
 * - count は bigint。長期運用でも桁あふれしない（mode: number, 2^53 まで安全）。
 */
export const InteractionCounterTable = pgTable(
  "interaction_counters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    action: text("action").notNull(),
    shard: smallint("shard").notNull().default(0),
    count: bigint("count", { mode: "number" }).notNull().default(0),
    firstOccurredAt: timestamp("first_occurred_at", { withTimezone: true }).notNull().defaultNow(),
    lastOccurredAt: timestamp("last_occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // ON CONFLICT ターゲット兼、(target_type, target_id) 前方一致の集計走査索引
    targetActionShardUnique: uniqueIndex("interaction_counters_target_action_shard_uq").on(
      table.targetType,
      table.targetId,
      table.action,
      table.shard,
    ),
  }),
);
