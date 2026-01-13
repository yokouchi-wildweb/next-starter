// src/features/core/user/utils/roleHelpers.ts
// ロール関連ヘルパー関数

import { ALL_ROLES } from "@/registry/roleRegistry";
import {
  CORE_ROLE_IDS,
  USER_ROLE_LABELS,
  USER_ROLE_CATEGORIES,
  USER_ROLE_HAS_PROFILE,
  type CoreRoleId,
  type UserRoleType,
} from "../constants/role";
import type { RoleCategory } from "../types";

/**
 * ロールIDがコアロールか判定
 */
export function isCoreRole(roleId: string): roleId is CoreRoleId {
  return CORE_ROLE_IDS.includes(roleId as CoreRoleId);
}

/**
 * カテゴリ別のロールID配列を取得
 */
export function getRolesByCategory(category: RoleCategory): UserRoleType[] {
  return ALL_ROLES.filter((r) => r.category === category).map(
    (r) => r.id,
  ) as UserRoleType[];
}

/**
 * カテゴリ別のロールオプションを取得（セレクトボックス用）
 */
export function getRoleOptionsByCategory(
  category: RoleCategory,
): readonly { id: UserRoleType; name: string }[] {
  return ALL_ROLES.filter((r) => r.category === category).map((r) => ({
    id: r.id as UserRoleType,
    name: r.label,
  }));
}

/**
 * プロフィールを持つロールのID配列を取得
 */
export function getRolesWithProfile(): UserRoleType[] {
  return ALL_ROLES.filter((r) => r.hasProfile).map(
    (r) => r.id,
  ) as UserRoleType[];
}

/**
 * ロールラベルのフォーマッタ
 */
export function formatUserRoleLabel(
  role: string | null | undefined,
  fallback = "",
): string {
  if (!role) {
    return fallback;
  }
  return USER_ROLE_LABELS[role as UserRoleType] ?? role;
}

/**
 * ロールのカテゴリを取得
 */
export function getRoleCategory(role: UserRoleType): RoleCategory {
  return USER_ROLE_CATEGORIES[role];
}

/**
 * ロールがプロフィールを持つか判定
 */
export function hasRoleProfile(role: UserRoleType): boolean {
  return USER_ROLE_HAS_PROFILE[role];
}
