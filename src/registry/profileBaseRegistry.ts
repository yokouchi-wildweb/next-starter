// src/registry/profileBaseRegistry.ts
// ロール → プロフィールベースのマッピング（自動生成対象）
//
// このファイルは role:generate スクリプトによって更新されます。
// アンカーコメント間のコードは自動生成スクリプトによって更新されます。
//
// ヘルパー関数は @/features/core/userProfile/utils/profileBaseHelpers を使用してください

import { createProfileBase } from "@/features/core/userProfile/utils/createProfileBase";
import type { ProfileBase } from "@/features/core/userProfile/types";

// === AUTO-GENERATED IMPORTS START ===
import { UserProfileTable } from "@/features/core/userProfile/generated/user";
import { ContributorProfileTable } from "@/features/core/userProfile/generated/contributor";
import { AdminProfileTable } from "@/features/core/userProfile/generated/admin";
// === AUTO-GENERATED IMPORTS END ===

/**
 * ロール → プロフィールベースのマッピング
 */
export const PROFILE_BASE_REGISTRY: Record<string, ProfileBase> = {
  // === AUTO-GENERATED ENTRIES START ===
  user: createProfileBase(UserProfileTable),
  contributor: createProfileBase(ContributorProfileTable),
  admin: createProfileBase(AdminProfileTable),
  // === AUTO-GENERATED ENTRIES END ===
};
