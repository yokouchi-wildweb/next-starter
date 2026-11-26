// src/domains/core/messaging/entities/messageIdempotencyKey/drizzle.ts

import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const MessageIdempotencyKeyTable = pgTable("message_idempotency_keys", {
  idempotency_key: text("idempotency_key").primaryKey(),
  /** 消された送信の id（送信の行は消えているので FK を張らない） */
  dispatch_id: uuid("dispatch_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
