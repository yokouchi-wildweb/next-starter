// src/features/foo/entities/drizzle.ts

import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const FooTable = pgTable("fooes", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  filesize: integer("filesize"),
  media: text("media"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
