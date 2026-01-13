// src/features/core/user/components/admin/form/demoUserProfiles.ts
/**
 * デモユーザー管理画面で使用するプロフィール設定
 *
 * ロールを追加/削除する場合:
 * 1. profile.json をインポート
 * 2. DEMO_USER_PROFILES に追加/削除
 */

import type { ProfileConfig } from "@/features/core/userProfile/profiles";
import adminProfile from "@/features/core/userProfile/profiles/admin.profile.json";
import userProfile from "@/features/core/userProfile/profiles/user.profile.json";
import contributorProfile from "@/features/core/userProfile/profiles/contributor.profile.json";

export const DEMO_USER_PROFILES: Record<string, ProfileConfig> = {
  admin: adminProfile as ProfileConfig,
  user: userProfile as ProfileConfig,
  contributor: contributorProfile as ProfileConfig,
};
