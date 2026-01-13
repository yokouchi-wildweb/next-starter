// src/features/core/userProfile/utils/profileBaseHelpers.ts
// プロフィールベースのヘルパー関数

import { PROFILE_BASE_REGISTRY } from "../registry/profileBases";
import type { ProfileBase } from "../types";

/**
 * プロフィールベースを持つロールの一覧
 */
export const PROFILE_ROLES = Object.keys(PROFILE_BASE_REGISTRY);

/**
 * ロールがプロフィールベースを持つか確認
 */
export function hasProfileBase(role: string): boolean {
  return role in PROFILE_BASE_REGISTRY;
}

/**
 * ロールに対応するプロフィールベースを取得
 */
export function getProfileBase(role: string): ProfileBase | null {
  return PROFILE_BASE_REGISTRY[role] ?? null;
}
