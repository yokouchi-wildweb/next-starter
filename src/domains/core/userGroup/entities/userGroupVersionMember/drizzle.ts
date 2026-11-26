// src/domains/core/userGroup/entities/userGroupVersionMember/drizzle.ts

import { UserGroupVersionTable } from "../userGroupVersion/drizzle";
import { UserTable } from "@/domains/core/user/entities/drizzle";
import { foreignKey, index, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";

export const UserGroupVersionMemberTable = pgTable(
  "user_group_version_members",
  {
    version_id: uuid("version_id").notNull(),
    user_id: uuid("user_id").notNull(),
  },
  (table) => [
    primaryKey({ name: "user_group_version_members_pk", columns: [table.version_id, table.user_id] }),
    foreignKey({ name: "user_group_vmembers_version_fk", columns: [table.version_id], foreignColumns: [UserGroupVersionTable.id] }).onDelete("cascade"),
    foreignKey({ name: "user_group_vmembers_user_fk", columns: [table.user_id], foreignColumns: [UserTable.id] }).onDelete("cascade"),
    index("user_group_vmembers_user_idx").on(table.user_id),
  ],
);
