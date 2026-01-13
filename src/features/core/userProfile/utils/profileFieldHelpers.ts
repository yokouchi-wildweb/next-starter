// src/features/core/userProfile/utils/profileFieldHelpers.ts
// プロフィールフィールド関連ヘルパー関数

import type { ProfileFieldConfig, ProfileFieldTag } from "../types";
import { hasRoleProfile, type UserRoleType } from "@/features/core/user/constants";
import { ALL_PROFILES, getProfileFieldsForRole } from "../profiles";

/**
 * ロールのプロフィール設定を取得
 */
function getProfileConfig(role: UserRoleType) {
  return ALL_PROFILES.find((p) => p.roleId === role);
}

/**
 * ロールのプロフィールフィールド設定を取得
 */
export function getProfileFields(
  role: UserRoleType,
): readonly ProfileFieldConfig[] {
  return getProfileFieldsForRole(role);
}

/**
 * 指定タグに属するフィールドを取得
 * @param role ロール
 * @param tag タグ名
 * @param excludeHidden hidden フィールドを除外するか（デフォルト: true）
 */
export function getFieldsByTag(
  role: UserRoleType,
  tag: ProfileFieldTag,
  excludeHidden = true,
): ProfileFieldConfig[] {
  if (!hasRoleProfile(role)) {
    return [];
  }
  const config = getProfileConfig(role);
  const tagFields = config?.tags?.[tag] ?? [];
  const allFields = getProfileFields(role);

  return allFields.filter((field) => {
    if (excludeHidden && field.formInput === "hidden") {
      return false;
    }
    return tagFields.includes(field.name);
  }) as ProfileFieldConfig[];
}

/**
 * 本登録画面で表示するフィールドを取得
 */
export function getRegistrationFields(
  role: UserRoleType,
): ProfileFieldConfig[] {
  return getFieldsByTag(role, "registration");
}

/**
 * マイページで表示するフィールドを取得
 */
export function getMyPageFields(
  role: UserRoleType,
): ProfileFieldConfig[] {
  return getFieldsByTag(role, "mypage");
}

/**
 * 管理画面で表示するフィールドを取得（hidden 除く全て）
 */
export function getAdminFields(
  role: UserRoleType,
): ProfileFieldConfig[] {
  if (!hasRoleProfile(role)) {
    return [];
  }
  const fields = getProfileFields(role);
  return fields.filter((field) => field.formInput !== "hidden") as ProfileFieldConfig[];
}
