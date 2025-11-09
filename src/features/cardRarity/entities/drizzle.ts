// src/features/cardRarity/entities/drizzle.ts

import { pgTable, text, timestamp, integer, uuid } from "drizzle-orm/pg-core";
import { TitleTable } from "@/features/title/entities/drizzle";

export const CardRarityTable = pgTable("card_rarities", {
  id: uuid("id").defaultRandom().primaryKey(),
  titleId: uuid("title_id")
    .notNull()
    .references(() => TitleTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
