// src/features/core/userGroup/entities/drizzle.ts
// ユーザーグループの表(D103)。user に列も表も足さない(独立した core ドメイン、門 userGroups がドメインごと閉じる D99)。
// - user_groups: グループ 1 つ(種類・状態・例外の静的グループの持ち主・定期計算の今の版)
// - user_group_definitions: 動的・定期計算の条件の定義の木(グループに 1 つ)
// - user_group_members: 静的グループの一員(グループ × 利用者で一意)
// - user_group_versions: 定期計算の版(計算の時刻・失敗・人数)。今の版は user_groups.current_version
// - user_group_version_members: 定期計算の版ごとの一員(計算し終えた版を一度に切り替える)
// FK の名前は短く付ける(drizzle の自動の名前は 63 字を超えて切られる)

import { boolean, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { UserTable } from "@/features/core/user/entities/drizzle";

import type { UserGroupDefinitionNode, UserGroupKind, UserGroupStatus, UserGroupVersionStatus } from "./schema";

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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ name: "user_groups_owner_fk", columns: [table.owner_group_id], foreignColumns: [table.id] }).onDelete("cascade"),
    index("user_groups_owner_idx").on(table.owner_group_id),
    index("user_groups_kind_status_idx").on(table.kind, table.status),
  ],
);

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
  },
  (table) => [
    foreignKey({ name: "user_group_versions_group_fk", columns: [table.group_id], foreignColumns: [UserGroupTable.id] }).onDelete("cascade"),
    uniqueIndex("user_group_versions_group_version_uniq").on(table.group_id, table.version),
  ],
);

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
