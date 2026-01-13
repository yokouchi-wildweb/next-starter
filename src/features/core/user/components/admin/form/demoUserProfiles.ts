// src/features/core/user/components/admin/form/demoUserProfiles.ts
/**
 * デモユーザー管理画面で使用するプロフィール設定
 *
 * 全カテゴリのロールを動的に取得
 */

import { getProfilesByCategory } from "@/features/core/userProfile/utils/profileSchemaHelpers";

export const DEMO_USER_PROFILES = {
  ...getProfilesByCategory("admin"),
  ...getProfilesByCategory("user"),
};
