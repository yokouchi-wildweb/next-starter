// src/features/core/analytics/entities/drizzle.ts
// DAU（日次アクティブユーザー）計測テーブル

import { date, index, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const UserDailyActivityTable = pgTable(
  "user_daily_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    activityDate: date("activity_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userDateUnique: uniqueIndex("user_daily_activities_user_date_idx").on(
      table.userId,
      table.activityDate,
    ),
    activityDateIdx: index("user_daily_activities_activity_date_idx").on(table.activityDate),
  }),
);
