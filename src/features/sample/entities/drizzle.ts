// src/features/sample/entities/drizzle.ts

import { boolean, date, integer, pgEnum, pgTable, primaryKey, text, time, timestamp, uuid } from "drizzle-orm/pg-core";
import { SampleCategoryTable } from "@/features/sampleCategory/entities/drizzle";
import { SampleTagTable } from "@/features/sampleTag/entities/drizzle";

export const SampleSelectEnum = pgEnum("sample_select_enum", ["apple", "orange", "berry"]);

export const SampleTable = pgTable("samples", {
  id: uuid("id").defaultRandom().primaryKey(),
  sample_category_id: uuid("sample_category_id")
    .references(() => SampleCategoryTable.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  number: integer("number").default(999),
  rich_number: integer("rich_number"),
  switch: boolean("switch"),
  radio: boolean("radio"),
  select: SampleSelectEnum("select").default("orange"),
  multi_select: text("multi_select").array().default([]).notNull(),
  sale_start_at: timestamp("sale_start_at", { withTimezone: true }),
  date: date("date"),
  time: time("time"),
  main_image: text("main_image"),
  sub_image: text("sub_image"),
  description: text("description"),
  sort_order: text("sort_order"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const SampleToSampleTagTable = pgTable(
  "sample_to_sample_tag",
  {
    sampleId: uuid("sample_id")
      .notNull()
      .references(() => SampleTable.id, { onDelete: "cascade" }),
    sampleTagId: uuid("sample_tag_id")
      .notNull()
      .references(() => SampleTagTable.id, { onDelete: "cascade" }),
  },
  (table) => {
    return { pk: primaryKey({ columns: [table.sampleId, table.sampleTagId] }) };
  },
);
