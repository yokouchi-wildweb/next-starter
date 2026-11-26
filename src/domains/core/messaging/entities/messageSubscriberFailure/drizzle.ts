// src/domains/core/messaging/entities/messageSubscriberFailure/drizzle.ts

import { MessageEventTable } from "../messageEvent/drizzle";
import { foreignKey, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const MessageSubscriberFailureTable = pgTable(
  "message_subscriber_failures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subscriber_key: text("subscriber_key").notNull(),
    event_id: uuid("event_id").notNull(),
    /** 失敗した回数 */
    attempts: integer("attempts").notNull().default(0),
    /** 最後の誤りの文(短く) */
    last_error: text("last_error"),
    /** 隔離した時刻(上限に達した。null = まだ次の実行で送り直す) */
    quarantined_at: timestamp("quarantined_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_message_subscriber_failures_key_event").on(table.subscriber_key, table.event_id),
    foreignKey({
      name: "message_subscriber_failures_event_fk",
      columns: [table.event_id],
      foreignColumns: [MessageEventTable.id],
    }).onDelete("cascade"),
  ],
);
