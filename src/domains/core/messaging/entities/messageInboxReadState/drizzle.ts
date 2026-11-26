// src/domains/core/messaging/entities/messageInboxReadState/drizzle.ts

import { UserTable } from "@/domains/user/entities/drizzle";
import { pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";

export const MessageInboxReadStateTable = pgTable("message_inbox_read_states", {
  user_id: uuid("user_id")
    .primaryKey()
    .references(() => UserTable.id, { onDelete: "cascade" }),
  /** この時刻以前に公開された行は既読。null = 全既読を一度もしていない */
  read_watermark_at: timestamp("read_watermark_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
