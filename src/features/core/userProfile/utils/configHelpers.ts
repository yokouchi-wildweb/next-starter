// src/features/core/userProfile/utils/configHelpers.ts
// プロフィール設定の取得ヘルパー

import { profileConfigs } from "@/features/core/userProfile/extensions/profileConfigs";
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
      .filter((roleId) => profileConfigs[roleId] && isRoleEnabled(roleId))
      .map((roleId) => [roleId, profileConfigs[roleId]])
  );
}

/**
 * 指定ロールのプロフィール設定を取得
 *
 * @param role - ロールID
 * @returns ProfileConfig または undefined
 */
export function getProfileConfig(role: string): ProfileConfig | undefined {
  return profileConfigs[role];
}
