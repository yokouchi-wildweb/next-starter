// src/features/series/entities/drizzle.ts

import { pgTable, text, timestamp, date, uuid } from "drizzle-orm/pg-core";
import { TitleTable } from "@/features/title/entities/drizzle";

export const SeriesTable = pgTable("series", {
  id: uuid("id").defaultRandom().primaryKey(),
  titleId: uuid("title_id")
    .notNull()
    .references(() => TitleTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  releaseDate: date("release_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
