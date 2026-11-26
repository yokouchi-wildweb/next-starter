// src/domains/core/userCounter/entities/userDailyCounter/drizzle.ts

import { date, index, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * per-user 日次カウンタテーブル。
 *
 * - 単位は (user_id, counter_key, date)。「このユーザーが○○をその日何回したか」。
 * - 累計（user_counters）と違い日付軸を持つため、日次制限（1日N回まで）や
 *   個人の日別推移の取得に使う。加算は bumpDaily（累計と同一 tx で両方加算）。
 * - シャーディングは持たない。各ユーザーは自分の行にしか書かないため、
 *   コンテンツ軸カウンタ（interaction_counters）のようなホット行競合が構造的に発生しない。
 * - ユーザー数 × 日数に比例して増えるため、行単位 retention_days（既定 730 日）で
 *   cron prune する（永久保持しない。累計側は prune 対象外なので合計は失われない）。
 * - date の日界は userCounterConfig.dailyTimeZone（既定 Asia/Tokyo）。
 */
export const UserDailyCounterTable = pgTable("user_daily_counters", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  counter_key: text("counter_key").notNull(),
  date: date("date").notNull(),
  count: integer("count").notNull().default(0),
  retention_days: integer("retention_days").notNull(),
}, (table) => [
  // ON CONFLICT ターゲット兼、(user_id, counter_key) の日別レンジ走査索引
  uniqueIndex("user_daily_counters_user_key_date_uq").on(
    table.user_id,
    table.counter_key,
    table.date,
  ),
  // retention pruning 用（date + retention_days * INTERVAL で算出）
  index("user_daily_counters_date_idx").on(table.date),
]);
