// src/features/core/userProfile/utils/profileBaseHelpers.ts
// プロフィールベースのヘルパー関数

import { PROFILE_BASE_REGISTRY } from "@/registry/profileBaseRegistry";
import type { ProfileBase } from "../types";

/**
 * プロフィールを持つロールの一覧
 */
export const PROFILE_ROLES = Object.keys(PROFILE_BASE_REGISTRY);

/**
 * ロールがプロフィールを持つか確認
 */
export function hasProfileBase(role: string): boolean {
  return role in PROFILE_BASE_REGISTRY;
}

/**
 * ロールに対応する ProfileBase を取得
 */
export function getProfileBase(role: string): ProfileBase | null {
  return PROFILE_BASE_REGISTRY[role] ?? null;
}
