// src/features/sampleImage/entities/drizzle.ts

import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { SampleTable } from "@/features/sample/entities/drizzle";

export const SampleImageTable = pgTable("sample_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  sample_id: uuid("sample_id").notNull()
    .references(() => SampleTable.id, { onDelete: "cascade" }),
  file: text("file").notNull(),
  sort_order: text("sort_order"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
