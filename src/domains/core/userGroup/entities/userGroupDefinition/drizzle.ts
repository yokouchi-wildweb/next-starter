// src/domains/core/userGroup/entities/userGroupDefinition/drizzle.ts

import { UserGroupTable } from "../userGroup/drizzle";
import type { UserGroupDefinitionNode } from "./schema";
import { boolean, foreignKey, jsonb, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";

export const UserGroupDefinitionTable = pgTable(
  "user_group_definitions",
  {
    group_id: uuid("group_id").primaryKey(),
    /** 条件の定義の木(and / or / not と部品の葉、entities/schema.ts) */
    tree: jsonb("tree").$type<UserGroupDefinitionNode>().notNull(),
    /** heavy の部品を含むか(1 人の確かめを拒み、定期計算にすれば使える) */
    has_heavy: boolean("has_heavy").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ name: "user_group_defs_group_fk", columns: [table.group_id], foreignColumns: [UserGroupTable.id] }).onDelete("cascade"),
  ],
);
