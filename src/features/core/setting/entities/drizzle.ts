// src/features/setting/entities/drizzle.ts

import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

import { getZodDefaults } from "@/lib/zod";

import { settingExtendedSchema } from "../setting.extended";
import type { SettingExtended } from "../setting.extended";

// extended jsonb のデフォルト値
// setting.extended.ts の Zod スキーマの .default() から自動導出する（単一ソース）。
// ダウンストリームは setting.extended.ts にフィールドを追加するだけでよく、ここを手で同期する必要はない。
// 注意: .default() を持たないフィールドは含まれない。必須フィールドを追加する場合は
// setting.extended.ts 側で .default() を必ず指定すること（DB マイグレーション不要）。
const EXTENDED_DEFAULT = getZodDefaults(settingExtendedSchema) as SettingExtended;

export const settingTable = pgTable("settings", {
  id: text("id").primaryKey(),
  adminListPerPage: integer("admin_list_per_page").default(100).notNull(),
  extended: jsonb("extended").$type<SettingExtended>().default(EXTENDED_DEFAULT),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
