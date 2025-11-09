// src/features/sampleCategory/entities/drizzle.ts

import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const SampleCategoryTable = pgTable("sample_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
