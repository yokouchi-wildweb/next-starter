// src/features/core/userCounter/entities/drizzle.ts

import { date, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * 汎用 per-user カウンタテーブル。
 *
 * - 単位は (user_id, counter_key)。1 ユーザ × 1 キーにつき 1 行。
 * - counter_key は名前空間付き文字列（採番は消費側ドメインの責務）。
 *   例: "secret_shop.dialog.<id>", "secret_shop.talk"
 * - first/last_occurred_at は「初回/直近の発生時刻」。既読・recency 判定に使う。
 * - 複合ユニーク (user_id, counter_key) は bump の ON CONFLICT ターゲットと、
 *   getCountersByPrefix の前方一致レンジ走査索引を兼ねる。
 */
export const UserCounterTable = pgTable("user_counters", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  counter_key: text("counter_key").notNull(),
  count: integer("count").notNull().default(0),
  // 発生時刻はサーバ管理（bump は now() を SQL 側で発行）。
  // defaultNow() は admin の汎用 CRUD create で省略された場合のフォールバック。
  first_occurred_at: timestamp("first_occurred_at", { withTimezone: true }).notNull().defaultNow(),
  last_occurred_at: timestamp("last_occurred_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // 複合ユニーク制約: [user_id, counter_key]
  uniqueIndex("user_counters_user_key_unique").on(table.user_id, table.counter_key),
]);

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
 * - date の日界は USER_COUNTER_CONFIG.dailyTimeZone（既定 Asia/Tokyo）。
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
