// src/domains/core/user/entities/userStatusHistory/drizzle.ts

import { UserStatusEnum, UserTable } from "../user/drizzle";
import { index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * ユーザーステータス遷移履歴（分析・集計用サテライトテーブル）。
 * - users テーブルに分析用カラムを追加しない方針（USER_ACQUISITION と同じ前例）に従い、
 *   ステータス遷移（退会・休会・復帰・BAN 等）を 1:N の履歴として恒久保存する
 * - 退会日時の日別集計 = to_status='withdrawn' を changed_at で GROUP BY
 * - 記録は recordStatusTransition (services/server/statusHistory.ts) に集約。
 *   コンプライアンス用途の audit_logs（保持期限あり）とは責務が別で、こちらは prune されない
 */
export const UserStatusHistoryTable = pgTable(
  "user_status_histories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),
    // 遷移前ステータス。新規作成（INSERT）による初期ステータス付与は null
    fromStatus: UserStatusEnum("from_status"),
    toStatus: UserStatusEnum("to_status").notNull(),
    // 遷移のきっかけ（self_withdraw / admin_soft_delete 等。語彙は entities/model.ts）
    trigger: text("trigger").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // ユーザー単位のタイムライン取得用
    userIdIdx: index("user_status_histories_user_id_idx").on(table.userId, table.changedAt),
    // 遷移先ステータス別の時系列集計用（例: 日別退会数）
    toStatusIdx: index("user_status_histories_to_status_idx").on(table.toStatus, table.changedAt),
  }),
);
