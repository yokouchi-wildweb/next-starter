// src/features/setting/entities/drizzle.ts

import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const settingTable = pgTable("settings", {
  id: text("id").primaryKey(),
  adminHeaderLogoImageUrl: text("admin_header_logo_image_url"),
  adminHeaderLogoImageDarkUrl: text("admin_header_logo_image_dark_url"),
  adminListPerPage: integer("admin_list_per_page").default(100).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
