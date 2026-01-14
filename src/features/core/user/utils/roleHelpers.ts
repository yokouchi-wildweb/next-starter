// src/features/core/user/utils/roleHelpers.ts
// ロール関連ヘルパー関数

import { ALL_ROLES } from "@/registry/roleRegistry";
import type { RoleConfig } from "@/features/core/user/types";
import type { UserRoleType } from "../constants/role";
import type { RoleCategory } from "../types";

/**
 * ロール設定を取得
 */
export function getRoleConfig(role: string): RoleConfig | undefined {
  return ALL_ROLES.find((r) => r.id === role);
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
 * 全ロールオプションを取得（セレクトボックス用）
 */
export function getAllRoleOptions(): readonly { id: UserRoleType; name: string }[] {
  return ALL_ROLES.map((r) => ({
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
  return getRoleConfig(role)?.label ?? role;
}

/**
 * ロールのカテゴリを取得
 */
export function getRoleCategory(role: string): RoleCategory | undefined {
  return getRoleConfig(role)?.category;
}

/**
 * ロールがプロフィールを持つか判定
 */
export function hasRoleProfile(role: string): boolean {
  return getRoleConfig(role)?.hasProfile ?? false;
}

/**
 * ロールの説明を取得
 */
export function getRoleDescription(role: string): string | undefined {
  return getRoleConfig(role)?.description;
}
