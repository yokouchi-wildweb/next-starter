// src/features/core/userProfile/utils/configHelpers.ts
// プロフィール設定の取得ヘルパー

import { PROFILE_CONFIG_REGISTRY } from "@/registry/profileConfigRegistry";
import { getRolesByCategory, isRoleEnabled, type RoleCategory } from "@/features/core/user/constants";
import type { ProfileConfig } from "../profiles";

/**
 * ロールカテゴリに属するプロフィール設定を取得
 *
 * @param category - ロールカテゴリ（"user" | "admin"）
 * @returns ロール → ProfileConfig のマッピング
 *
 * @example
 * const profiles = getProfilesByCategory("user");
 * // => { user: {...}, contributor: {...} }
 */
export function getProfilesByCategory(
  category: RoleCategory
): Record<string, ProfileConfig> {
  const roles = getRolesByCategory(category);
  return Object.fromEntries(
    roles
      .filter((roleId) => PROFILE_CONFIG_REGISTRY[roleId] && isRoleEnabled(roleId))
      .map((roleId) => [roleId, PROFILE_CONFIG_REGISTRY[roleId]])
  );
}

/**
 * 指定ロールのプロフィール設定を取得
 *
 * @param role - ロールID
 * @returns ProfileConfig または undefined
 */
export function getProfileConfig(role: string): ProfileConfig | undefined {
  return PROFILE_CONFIG_REGISTRY[role];
}
