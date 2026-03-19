// src/features/setting/entities/drizzle.ts

import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

import type { SettingExtended } from "../setting.extended";

export const settingTable = pgTable("settings", {
  id: text("id").primaryKey(),
  adminListPerPage: integer("admin_list_per_page").default(100).notNull(),
  extended: jsonb("extended").$type<SettingExtended>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
