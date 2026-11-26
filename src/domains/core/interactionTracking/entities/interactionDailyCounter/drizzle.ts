// src/domains/core/interactionTracking/entities/interactionDailyCounter/drizzle.ts

import { bigint, date, index, pgTable, smallint, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * インタラクション日次集計テーブル（永久保持・マーケティング分析の真）。
 *
 * - 単位は (date, target_type, target_id, action, source, shard)。
 *   record() 時に明細・累計カウンタと同一トランザクションで原子加算される
 *   （バッチ集計は無い。明細がいつ prune されても集計は最初から完成している）。
 * - 行数は「対象数 × アクション種 × 導線 × 日数」でしか増えず、
 *   ユーザー数・クリック数に比例しない。そのため prune 対象外・永久保持できる。
 * - date の日界は interactionTrackingConfig.aggregationTimeZone（既定 Asia/Tokyo）。
 * - source は導線別内訳の集計軸。未指定イベントは '' に正規化する
 *   （Postgres の UNIQUE は NULL 同士を重複と見なさないため NULL を許容しない）。
 * - shard は累計カウンタと同じホット行競合対策。日付が変われば行も分かれるため
 *   競合は日単位でも自然分散するが、単日に集中する用途に備えて同じ手当てを入れる。
 */
export const InteractionDailyCounterTable = pgTable(
  "interaction_daily_counters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    date: date("date").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    action: text("action").notNull(),
    source: text("source").notNull().default(""),
    shard: smallint("shard").notNull().default(0),
    count: bigint("count", { mode: "number" }).notNull().default(0),
  },
  (table) => ({
    // ON CONFLICT ターゲット
    dailyUnique: uniqueIndex("interaction_daily_counters_uq").on(
      table.date,
      table.targetType,
      table.targetId,
      table.action,
      table.source,
      table.shard,
    ),
    // 対象別の時系列取得（getDailySeries）用
    targetDateIdx: index("interaction_daily_counters_target_idx").on(
      table.targetType,
      table.targetId,
      table.date,
    ),
  }),
);
