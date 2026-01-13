// src/features/core/user/components/admin/form/generalUserProfiles.ts
/**
 * 一般ユーザー管理画面で使用するプロフィール設定
 *
 * user カテゴリのロールを動的に取得
 */

import { getProfilesByCategory } from "@/features/core/userProfile/utils/profileSchemaHelpers";

export const GENERAL_USER_PROFILES = getProfilesByCategory("user");
