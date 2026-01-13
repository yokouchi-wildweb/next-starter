// src/registry/profileBaseRegistry.ts
// ロール → プロフィールベースのマッピング（自動生成対象）
//
// このファイルは role:generate スクリプトによって更新されます。
// アンカーコメント間のコードは自動生成スクリプトによって更新されます。

import { createProfileBase } from "@/features/core/userProfile/utils/createProfileBase";
import type { ProfileBase } from "@/features/core/userProfile/types";

// === AUTO-GENERATED IMPORTS START ===
import { AdminProfileTable } from "@/features/core/userProfile/generated/admin";
import { UserProfileTable } from "@/features/core/userProfile/generated/user";
import { ContributorProfileTable } from "@/features/core/userProfile/generated/contributor";
// === AUTO-GENERATED IMPORTS END ===

/**
 * ロール → プロフィールベースのマッピング
 */
export const PROFILE_BASE_REGISTRY: Record<string, ProfileBase> = {
  // === AUTO-GENERATED ENTRIES START ===
  admin: createProfileBase(AdminProfileTable),
  user: createProfileBase(UserProfileTable),
  contributor: createProfileBase(ContributorProfileTable),
  // === AUTO-GENERATED ENTRIES END ===
};

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
