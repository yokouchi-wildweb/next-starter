// src/features/title/entities/drizzle.ts

import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const TitleTable = pgTable("titles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
