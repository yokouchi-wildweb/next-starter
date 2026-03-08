// src/features/core/notification/entities/notificationRead.ts
// notification_read: 既読管理テーブル（手動定義）

import { index, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";

import { NotificationTable } from "./drizzle";
import { UserTable } from "@/features/user/entities/drizzle";

export const NotificationReadTable = pgTable(
  "notification_reads",
  {
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => NotificationTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.notificationId, table.userId] }),
    index("notification_reads_user_id_idx").on(table.userId),
  ]
);
