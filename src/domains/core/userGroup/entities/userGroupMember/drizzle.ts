// src/domains/core/userGroup/entities/userGroupMember/drizzle.ts

import { UserGroupTable } from "../userGroup/drizzle";
import { UserTable } from "@/domains/core/user/entities/drizzle";
import { foreignKey, index, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";

export const UserGroupMemberTable = pgTable(
  "user_group_members",
  {
    group_id: uuid("group_id").notNull(),
    user_id: uuid("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "user_group_members_pk", columns: [table.group_id, table.user_id] }),
    foreignKey({ name: "user_group_members_group_fk", columns: [table.group_id], foreignColumns: [UserGroupTable.id] }).onDelete("cascade"),
    foreignKey({ name: "user_group_members_user_fk", columns: [table.user_id], foreignColumns: [UserTable.id] }).onDelete("cascade"),
    index("user_group_members_user_idx").on(table.user_id),
  ],
);
