// src/features/setting/entities/drizzle.ts

import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

import type { SettingExtended } from "../setting.extended";

// extended jsonb のデフォルト値
// 必須フィールドを満たす最小限の初期値。ダウンストリームで setting.extended.ts を拡張した場合は
// 合わせてここも更新する（あるいは $type のジェネリクスを部分型にするなど運用ルールを決める）
const EXTENDED_DEFAULT: SettingExtended = {
  maintenanceEnabled: false,
  maintenanceStartAt: null,
  maintenanceEndAt: null,
};

export const settingTable = pgTable("settings", {
  id: text("id").primaryKey(),
  adminListPerPage: integer("admin_list_per_page").default(100).notNull(),
  extended: jsonb("extended").$type<SettingExtended>().default(EXTENDED_DEFAULT),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
