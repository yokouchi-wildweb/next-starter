// src/features/userLineProfile/entities/drizzle.ts

import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { UserTable } from "@/features/core/user/entities/drizzle";

export const UserLineProfileTable = pgTable(
  "user_line_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => UserTable.id, { onDelete: "cascade" }),
    lineUserId: text("line_user_id").notNull(),
    displayName: text("display_name"),
    pictureUrl: text("picture_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    lineUserIdUnique: uniqueIndex("user_line_profiles_line_user_id_unique").on(table.lineUserId),
  }),
);
