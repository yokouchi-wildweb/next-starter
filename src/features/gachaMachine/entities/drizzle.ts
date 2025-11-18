// src/features/gachaMachine/entities/drizzle.ts

import { date, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const GachaMachineTable = pgTable("gacha_machines", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  main_image_url: text("main_image_url"),
  play_cost: integer("play_cost").notNull(),
  sale_start_at: timestamp("sale_start_at", { withTimezone: true }),
  sale_end_at: date("sale_end_at"),
  daily_limit: integer("daily_limit"),
  user_limit: integer("user_limit"),
  play_button_type: text("play_button_type").array().notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
