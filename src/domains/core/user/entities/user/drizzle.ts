// src/domains/core/user/entities/user/drizzle.ts

import type { UserMetadata } from "./model";
import { USER_PROVIDER_TYPES, USER_ROLES, USER_STATUSES } from "@/domains/core/user/constants";
import { defineHiddenColumns } from "@/lib/crud/server";
import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
    avatarUrl: text("avatar_url"),
    signupIp: text("signup_ip"),
    // 管理者がユーザー単位で自由記述メモを残すためのフィールド。
    // 既定では UI 非表示。userConfig.enableUserMemo を true にすると
    // 管理画面のユーザー一覧から編集できる。
    adminMemo: text("admin_memo"),
    // アカウントロックアウト関連フィールド (詳細: src/domains/core/user/config.ts の authLockout)
    failedLoginCount: integer("failed_login_count").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastFailedLoginAt: timestamp("last_failed_login_at", { withTimezone: true }),
    // 全セッション失効の境界時刻。getSessionUser で JWT.iat と比較し、
    // iat < sessionsInvalidatedAt なら認可拒否。
    // パスワード変更 / status=banned,security_locked への遷移で now() がセットされる。
    sessionsInvalidatedAt: timestamp("sessions_invalidated_at", { withTimezone: true }),
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
    // Analytics ユーザーフィルタ用（roles ホワイトリスト + デモ除外サブクエリ）
    roleIdx: index("users_role_idx").on(table.role),
    isDemoIdx: index("users_is_demo_idx").on(table.isDemo),
    // 「利用できる利用者」の述語(services/server/availableUsers.ts)とユーザーグループの条件の部品
    statusIdx: index("users_status_idx").on(table.status),
    deletedAtIdx: index("users_deleted_at_idx").on(table.deletedAt),
    // 最後のログインの時刻の条件(ユーザーグループの部品)
    lastAuthenticatedAtIdx: index("users_last_authenticated_at_idx").on(table.lastAuthenticatedAt),
    // 登録日の期間集計と、管理画面の一覧の既定の並び
    createdAtIdx: index("users_created_at_idx").on(table.createdAt),
    // 管理画面の一覧の更新日順と、差分リフレッシュ（createIncrementalRefresh）の走査
    updatedAtIdx: index("users_updated_at_idx").on(table.updatedAt),
    // 表示名の重複チェック用 (services/server/helpers/nameAvailability.ts)。
    // unique 制約ではなく検索用の expression index。一意性フラグ (userConfig.name.unique)
    // とは独立に常設し、caseInsensitive の両モードで同じ index が効くよう lower() で正規化する
    nameNormIdx: index("users_name_norm_idx").on(sql`lower(btrim(${table.name}))`),
  }),
);
// 秘匿カラム宣言: localPassword（ハッシュ）は createCrudService の全戻り値・
// 他ドメインの withRelations 展開から null 化され、サービス境界の外に出ない。
// サーバー内部での検証読み取りは finders/findByIdWithSecrets.ts（直接 drizzle）経由のみ。
defineHiddenColumns(UserTable, ["localPassword"]);
