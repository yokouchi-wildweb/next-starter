// src/features/setting/entities/drizzle.ts

import { pgTable, text, integer, timestamp, uuid } from "drizzle-orm/pg-core";

export const settingTable = pgTable("settings", {
  id: text("id").primaryKey(),
  developerMotivation: integer("developer_motivation").notNull(),
  adminHeaderLogoImageUrl: text("admin_header_logo_image_url"),
  adminHeaderLogoImageDarkUrl: text("admin_header_logo_image_dark_url"),
  adminListPerPage: integer("admin_list_per_page").default(100).notNull(),
  adminFooterText: text("admin_footer_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
