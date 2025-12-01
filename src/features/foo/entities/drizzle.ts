// src/features/foo/entities/drizzle.ts

import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const FooTable = pgTable("fooes", {
  id: uuid("id").defaultRandom().primaryKey(),
  filesize: integer("filesize"),
  width: integer("width"),
  media: text("media"),
  mimetype: text("mimetype"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
