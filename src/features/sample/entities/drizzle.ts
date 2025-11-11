// src/features/sample/entities/drizzle.ts

import { boolean, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { SampleCategoryTable } from "@/features/sampleCategory/entities/drizzle";

export const SampleSelectEnum = pgEnum("sample_select_enum", ["apple", "orange", "berry"]);

export const SampleTable = pgTable("samples", {
  id: uuid("id").defaultRandom().primaryKey(),
  sample_category_id: uuid("sample_category_id").notNull()
    .references(() => SampleCategoryTable.id),
  name: text("name").notNull(),
  number: integer("number"),
  rich_number: integer("rich_number"),
  switch: boolean("switch"),
  radio: boolean("radio"),
  select: SampleSelectEnum("select"),
  main_image: text("main_image"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
