// src/features/core/userProfile/utils/profileBaseHelpers.ts
// プロフィールベースのヘルパー関数

import { profileBases } from "@/features/core/userProfile/extensions/profileBases";
import type { ProfileBase } from "../types";

/**
 * プロフィールを持つロールの一覧
 */
export const PROFILE_ROLES = Object.keys(profileBases);

/**
 * ロールがプロフィールを持つか確認
 */
export function hasProfileBase(role: string): boolean {
  return role in profileBases;
}

/**
 * ロールに対応する ProfileBase を取得
 */
export function getProfileBase(role: string): ProfileBase | null {
  return profileBases[role] ?? null;
}
