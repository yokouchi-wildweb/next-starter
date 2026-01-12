// src/features/setting/entities/drizzle.ts

import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const settingTable = pgTable("settings", {
  id: text("id").primaryKey(),
  adminListPerPage: integer("admin_list_per_page").default(100).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
