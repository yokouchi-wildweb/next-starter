// src/features/setting/entities/drizzle.ts

import { pgTable, text, integer, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";

export const settingThemeColorEnum = pgEnum("setting_theme_color_enum", ["blue", "green", "red"]);

export const settingTable = pgTable("settings", {
  id: text("id").primaryKey(),
  adminHeaderLogoImageUrl: text("admin_header_logo_image_url"),
  adminHeaderLogoImageDarkUrl: text("admin_header_logo_image_dark_url"),
  adminListPerPage: integer("admin_list_per_page").default(100).notNull(),
  adminFooterText: text("admin_footer_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),

  // === 拡張カラム（自動生成）===
  siteTitle: text("site_title").default(""),
  maintenanceMode: boolean("maintenance_mode").default(false),
  themeColor: settingThemeColorEnum("theme_color").default("blue"),
  ogImageUrl: text("og_image_url"),
  // === 拡張カラム終了 ===
});
