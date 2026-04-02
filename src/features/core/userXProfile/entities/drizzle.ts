// src/features/userXProfile/entities/drizzle.ts

import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { UserTable } from "@/features/core/user/entities/drizzle";

export const UserXProfileTable = pgTable(
  "user_x_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => UserTable.id, { onDelete: "cascade" }),
    xUserId: text("x_user_id").notNull(),
    username: text("username"),
    displayName: text("display_name"),
    profileImageUrl: text("profile_image_url"),
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
    scopes: text("scopes").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    xUserIdUnique: uniqueIndex("user_x_profiles_x_user_id_unique").on(table.xUserId),
  }),
);
