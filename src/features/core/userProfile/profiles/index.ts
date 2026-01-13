// src/features/core/userProfile/profiles/index.ts
// プロフィール設定の読み込みとエクスポート

import type { ProfileFieldConfig } from "../types";

// JSON プロフィール設定の読み込み
import contributorProfile from "./contributor.profile.json";

/**
 * プロフィール設定の型
 */
export type ProfileConfig = {
  roleId: string;
  fields: ProfileFieldConfig[];
};

/**
 * 全プロフィール設定
 */
export const ALL_PROFILES: readonly ProfileConfig[] = [
  contributorProfile as ProfileConfig,
];

/**
 * ロール別プロフィールフィールドマッピング
 */
export const PROFILE_FIELDS_BY_ROLE: Record<string, readonly ProfileFieldConfig[]> =
  Object.fromEntries(ALL_PROFILES.map((p) => [p.roleId, p.fields]));

/**
 * ロールのプロフィールフィールドを取得
 */
export function getProfileFieldsForRole(roleId: string): readonly ProfileFieldConfig[] {
  return PROFILE_FIELDS_BY_ROLE[roleId] ?? [];
}
