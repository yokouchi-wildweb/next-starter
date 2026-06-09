// src/features/core/notification/entities/notificationReadState.ts
// notification_read_states: ユーザーごとの既読ウォーターマーク（手動定義）
//
// read_watermark_at 以前に公開された通知は「既読」とみなす（全既読を O(1) で表現）。
// 個別既読は notification_reads 側に残すハイブリッド構成。
// 既読判定ロジックは services/server/notification/readState.ts に集約。

import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { UserTable } from "@/features/user/entities/drizzle";

export const NotificationReadStateTable = pgTable("notification_read_states", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => UserTable.id, { onDelete: "cascade" }),
  // この時刻以前に公開された通知は既読扱い。NULL = 全既読を一度も実行していない
  readWatermarkAt: timestamp("read_watermark_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
