// src/features/foo/entities/drizzle.ts

import { integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { SampleCategoryTable } from "@/features/sampleCategory/entities/drizzle";

export const FooTypeEnum = pgEnum("foo_type_enum", ["apple", "orange"]);

export const FooTable = pgTable("fooes", {
  id: uuid("id").defaultRandom().primaryKey(),
  sample_category_id: uuid("sample_category_id").notNull()
    .references(() => SampleCategoryTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: FooTypeEnum("type").notNull(),
  num: integer("num"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  // 複合ユニーク制約 0: [name, type, sample_category_id]
  uniqueIndex("fooes_composite_unique_0").on(table.name, table.type, table.sample_category_id)
]);
