// src/registry/profileConfigRegistry.ts
// プロフィール設定のレジストリ（自動生成）
//
// このファイルは role:generate スクリプトによって自動生成されます

import type { ProfileConfig } from "@/features/core/userProfile/profiles";

// === AUTO-GENERATED IMPORTS START ===
import adminProfile from "@/features/core/userProfile/profiles/admin.profile.json";
import contributorProfile from "@/features/core/userProfile/profiles/contributor.profile.json";
import userProfile from "@/features/core/userProfile/profiles/user.profile.json";
// === AUTO-GENERATED IMPORTS END ===

/**
 * ロール → プロフィール設定のマッピング
 */
export const PROFILE_CONFIG_REGISTRY: Record<string, ProfileConfig> = {
  // === AUTO-GENERATED ENTRIES START ===
  admin: adminProfile as ProfileConfig,
  contributor: contributorProfile as ProfileConfig,
  user: userProfile as ProfileConfig,
  // === AUTO-GENERATED ENTRIES END ===
};
