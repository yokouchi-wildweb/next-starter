// src/features/user/entities/drizzle.ts

import { USER_PROVIDER_TYPES, USER_ROLES, USER_STATUSES } from "@/features/core/user/constants";
import { boolean, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { UserTagTable } from "@/features/core/userTag/entities/drizzle";
import type { UserMetadata } from "./model";

export const UserRoleEnum = pgEnum("user_role", [...USER_ROLES]);
export const UserProviderTypeEnum = pgEnum("user_provider_type", [...USER_PROVIDER_TYPES]);
export const UserStatusEnum = pgEnum("user_status", [...USER_STATUSES]);

export const UserTable = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerType: UserProviderTypeEnum("provider_type").notNull(),
    providerUid: text("provider_uid").notNull(),
    email: text("email"),
    name: text("name"),
    role: UserRoleEnum("role").notNull(),
    localPassword: text("local_password"),
    status: UserStatusEnum("status").default("pending").notNull(),
    isDemo: boolean("is_demo").default(false).notNull(),
    lastAuthenticatedAt: timestamp("last_authenticated_at", { withTimezone: true }),
    phoneNumber: text("phone_number").unique(),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<UserMetadata>().default({}).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    providerTypeUidUnique: uniqueIndex("users_provider_type_uid_idx").on(
      table.providerType,
      table.providerUid,
    ),
  }),
);

export const UserToUserTagTable = pgTable(
  "user_to_user_tag",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),
    userTagId: uuid("user_tag_id")
      .notNull()
      .references(() => UserTagTable.id, { onDelete: "cascade" }),
  },
  (table) => {
    return { pk: primaryKey({ columns: [table.userId, table.userTagId] }) };
  },
);

