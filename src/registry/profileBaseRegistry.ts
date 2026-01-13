// src/registry/profileBaseRegistry.ts
// ロール → プロフィールベースのマッピング（自動生成対象）
//
// このファイルは role:generate スクリプトによって更新されます。
// アンカーコメント間のコードは自動生成スクリプトによって更新されます。

import { createProfileBase } from "@/features/core/userProfile/utils/createProfileBase";
import type { ProfileBase } from "@/features/core/userProfile/types";

// === AUTO-GENERATED IMPORTS START ===
import { ContributorProfileTable } from "@/features/core/userProfile/entities/contributorProfile";
import { DebugerProfileTable } from "@/features/core/userProfile/entities/debugerProfile";
import { UserProfileTable } from "@/features/core/userProfile/entities/userProfile";
import { AdminProfileTable } from "@/features/core/userProfile/entities/adminProfile";
// === AUTO-GENERATED IMPORTS END ===

/**
 * ロール → プロフィールベースのマッピング
 */
export const PROFILE_BASE_REGISTRY: Record<string, ProfileBase> = {
  // === AUTO-GENERATED ENTRIES START ===
  contributor: createProfileBase(ContributorProfileTable),
  debuger: createProfileBase(DebugerProfileTable),
  user: createProfileBase(UserProfileTable),
  admin: createProfileBase(AdminProfileTable),
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
