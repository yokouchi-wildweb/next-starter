// src/domains/core/userGroup/entities/userGroupVersion/drizzle.ts

import { UserGroupTable } from "../userGroup/drizzle";
import type { UserGroupVersionStatus } from "./schema";
import { foreignKey, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const UserGroupVersionTable = pgTable(
  "user_group_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    group_id: uuid("group_id").notNull(),
    version: integer("version").notNull(),
    status: text("status").$type<UserGroupVersionStatus>().notNull().default("computing"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    computedAt: timestamp("computed_at", { withTimezone: true }),
    /** 失敗の理由(status failed の時) */
    error: text("error"),
    member_count: integer("member_count"),
    /**
     * 書きかけの版の再開の位置(書き終えた最後の利用者 id。利用者 id の昇順で書く)。null = まだ書いていない。
     * 定期計算の版と、静的グループの置き換えの下書き(静的グループの computing の版)が使う
     */
    resume_after: uuid("resume_after"),
  },
  (table) => [
    foreignKey({ name: "user_group_versions_group_fk", columns: [table.group_id], foreignColumns: [UserGroupTable.id] }).onDelete("cascade"),
    uniqueIndex("user_group_versions_group_version_uniq").on(table.group_id, table.version),
  ],
);
