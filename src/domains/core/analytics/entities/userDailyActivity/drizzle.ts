// src/domains/core/analytics/entities/userDailyActivity/drizzle.ts

import { date, index, pgTable, primaryKey, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
