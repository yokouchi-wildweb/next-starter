// src/domains/core/userGroup/entities/userGroup/drizzle.ts

import type { UserGroupKind, UserGroupStatus } from "./schema";
import { foreignKey, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const UserGroupTable = pgTable(
  "user_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    kind: text("kind").$type<UserGroupKind>().notNull(),
    /**
     * 持ち主のグループ(画面の「例外の人を足す・外す」が裏で作る静的グループだけ。一覧と選択肢に出さず、持ち主を消すと一緒に消える)。
     * null = ふつうのグループ
     */
    owner_group_id: uuid("owner_group_id"),
    status: text("status").$type<UserGroupStatus>().notNull().default("active"),
    /** 定期計算の今の版(user_group_versions.version、null = まだ計算し終えた版が無い)。scheduled だけ */
    current_version: integer("current_version"),
    /** 定期計算の間隔(分。scheduled だけ。null = 設定の既定 recompute.defaultIntervalMinutes)。最後の版の計算の開始からこの間隔で期限が来る */
    recompute_interval_minutes: integer("recompute_interval_minutes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ name: "user_groups_owner_fk", columns: [table.owner_group_id], foreignColumns: [table.id] }).onDelete("cascade"),
    index("user_groups_owner_idx").on(table.owner_group_id),
    index("user_groups_kind_status_idx").on(table.kind, table.status),
  ],
);
