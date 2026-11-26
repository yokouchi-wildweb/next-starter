// src/domains/core/messaging/entities/messageInboxRead/drizzle.ts

import { MessageInboxItemTable } from "../messageInboxItem/drizzle";
import { UserTable } from "@/domains/user/entities/drizzle";
import { index, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";

export const MessageInboxReadTable = pgTable(
  "message_inbox_reads",
  {
    item_id: uuid("item_id")
      .notNull()
      .references(() => MessageInboxItemTable.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),
    read_at: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.item_id, table.user_id] }),
    index("idx_message_inbox_reads_user").on(table.user_id),
  ],
);
