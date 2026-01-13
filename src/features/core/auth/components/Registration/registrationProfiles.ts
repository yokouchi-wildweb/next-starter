// src/features/core/auth/components/Registration/registrationProfiles.ts
/**
 * 本登録画面で使用するプロフィール設定
 *
 * user カテゴリのロールを動的に取得
 */

import { getProfilesByCategory } from "@/features/core/userProfile/utils/profileSchemaHelpers";

export const REGISTRATION_PROFILES = getProfilesByCategory("user");
