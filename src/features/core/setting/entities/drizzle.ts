// src/features/setting/entities/drizzle.ts

import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

// singleton 1 行(id = "global")+ jsonb 1 列。行は保存したキーだけを持ち、既定値は書かない(キーの定義: ../fields/)
export const settingTable = pgTable("settings", {
  id: text("id").primaryKey(),
  extended: jsonb("extended").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
