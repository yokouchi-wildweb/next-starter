// src/domains/core/messaging/entities/messageSubscriberCursor/drizzle.ts

import { bigint, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const MessageSubscriberCursorTable = pgTable("message_subscriber_cursors", {
  /** 購読の鍵 */
  subscriber_key: text("subscriber_key").primaryKey(),
  /** 渡し終えた事件の seq(0 = まだ) */
  last_seq: bigint("last_seq", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
