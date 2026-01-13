// src/features/core/user/constants/role.ts
// ロール派生定数

import { ALL_ROLES } from "../roles";
import type { RoleCategory } from "../types";

/**
 * ロールID配列（DBスキーマ、バリデーション用）
 */
export const USER_ROLES = ALL_ROLES.map((r) => r.id) as unknown as readonly [
  "admin",
  "user",
  ...string[],
];

/**
 * ロールの型
 */
export type UserRoleType = (typeof USER_ROLES)[number];

/**
 * UI表示用のロールオプション（セレクトボックス等）
 */
export const USER_ROLE_OPTIONS: readonly { id: UserRoleType; name: string }[] =
  ALL_ROLES.map((r) => ({ id: r.id, name: r.label })) as readonly {
    id: UserRoleType;
    name: string;
  }[];

/**
 * ロールのラベルマッピング
 */
export const USER_ROLE_LABELS: Record<UserRoleType, string> = Object.fromEntries(
  ALL_ROLES.map((r) => [r.id, r.label]),
) as Record<UserRoleType, string>;

/**
 * ロールの説明マッピング
 */
export const USER_ROLE_DESCRIPTIONS: Record<UserRoleType, string | undefined> =
  Object.fromEntries(ALL_ROLES.map((r) => [r.id, r.description])) as Record<
    UserRoleType,
    string | undefined
  >;

/**
 * ロールのカテゴリマッピング
 */
export const USER_ROLE_CATEGORIES: Record<UserRoleType, RoleCategory> =
  Object.fromEntries(ALL_ROLES.map((r) => [r.id, r.category])) as Record<
    UserRoleType,
    RoleCategory
  >;

/**
 * ロールがプロフィールを持つかのマッピング
 */
export const USER_ROLE_HAS_PROFILE: Record<UserRoleType, boolean> =
  Object.fromEntries(ALL_ROLES.map((r) => [r.id, r.hasProfile])) as Record<
    UserRoleType,
    boolean
  >;
