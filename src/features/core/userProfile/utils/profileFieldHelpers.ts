// src/features/core/userProfile/utils/profileFieldHelpers.ts
// プロフィールフィールド関連ヘルパー関数

import type { ProfileFieldConfig } from "@/features/core/user/types";
import { hasRoleProfile, type UserRoleType } from "@/features/core/user/constants";
import { getProfileFieldsForRole } from "../profiles";

/**
 * プロフィールフィールドタグ型
 * コアタグ + カスタムタグ
 */
export type ProfileFieldTag = "admin" | "registration" | "mypage" | "notification";

/**
 * ロールのプロフィールフィールド設定を取得
 */
export function getProfileFields(
  role: UserRoleType,
): readonly ProfileFieldConfig[] {
  return getProfileFieldsForRole(role);
}

/**
 * 指定タグを持つフィールドを取得（汎用フィルタ）
 * @param role ロール
 * @param includeTags 含めるタグ（いずれかにマッチ）
 * @param excludeHidden hidden フィールドを除外するか（デフォルト: true）
 */
export function getFieldsByTags(
  role: UserRoleType,
  includeTags: ProfileFieldTag[],
  excludeHidden = true,
): ProfileFieldConfig[] {
  if (!hasRoleProfile(role)) {
    return [];
  }
  const fields = getProfileFields(role);
  return fields.filter((field) => {
    if (excludeHidden && field.formInput === "hidden") {
      return false;
    }
    return field.tags.some((tag) => includeTags.includes(tag as ProfileFieldTag));
  }) as ProfileFieldConfig[];
}

/**
 * 本登録画面で表示するフィールドを取得
 */
export function getRegistrationFields(
  role: UserRoleType,
): ProfileFieldConfig[] {
  return getFieldsByTags(role, ["registration"]);
}

/**
 * マイページで表示するフィールドを取得
 */
export function getMyPageFields(
  role: UserRoleType,
): ProfileFieldConfig[] {
  return getFieldsByTags(role, ["mypage"]);
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
