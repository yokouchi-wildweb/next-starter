// src/features/core/userCounter/entities/drizzle.ts

import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
