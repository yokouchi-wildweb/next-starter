// src/features/core/cronCheckpoint/entities/drizzle.ts

import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * cron タスクのチェックポイント（ウォータマーク）テーブル。
 *
 * - 1 タスク（名前空間付き文字列 name）につき 1 行。
 *   例: "user-metrics-refresh", "analytics-rollup.wallet"
 * - checkpoint_at = 「この時刻までの入力は処理済み」を表す単調増加の時刻。
 *   advanceCheckpoint は GREATEST で前進のみ（後退しない）。巻き戻しは
 *   resetCheckpoint（運用者の明示操作）のみ。
 * - 差分 cron（updated_at ウォータマーク走査）と時間予算ランナーの再開位置に使う。
 *   HTTP ルートは持たない（server-internal only）。
 */
export const CronCheckpointTable = pgTable("cron_checkpoints", {
  name: text("name").primaryKey(),
  checkpointAt: timestamp("checkpoint_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
