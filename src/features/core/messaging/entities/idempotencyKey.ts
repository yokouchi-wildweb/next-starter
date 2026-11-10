// src/features/core/messaging/entities/idempotencyKey.ts
//
// 保持の cron が message_dispatches の行を消す時、その回の idempotency_key をここへ移す。
// 既定で無期限に残す（期限は設定）。重複の確かめは message_dispatches と両方を跨いで行う。

import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const MessageIdempotencyKeyTable = pgTable("message_idempotency_keys", {
  idempotency_key: text("idempotency_key").primaryKey(),
  /** 消された回の id（回の行は消えているので FK を張らない） */
  dispatch_id: uuid("dispatch_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
