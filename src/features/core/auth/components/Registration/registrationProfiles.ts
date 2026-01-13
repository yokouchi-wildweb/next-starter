// src/features/core/auth/components/Registration/registrationProfiles.ts
/**
 * 本登録画面で使用するプロフィール設定
 *
 * ロールを追加/削除する場合:
 * 1. profile.json をインポート
 * 2. REGISTRATION_PROFILES に追加/削除
 */

import type { ProfileConfig } from "@/features/core/userProfile/profiles";
import userProfile from "@/features/core/userProfile/profiles/user.profile.json";
import contributorProfile from "@/features/core/userProfile/profiles/contributor.profile.json";

export const REGISTRATION_PROFILES: Record<string, ProfileConfig> = {
  // 最初に記載したロールがデフォルトになります
  user: userProfile as ProfileConfig, // Default
  contributor: contributorProfile as ProfileConfig,
};
