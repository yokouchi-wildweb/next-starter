// src/features/core/user/components/admin/form/managerialUserProfiles.ts
/**
 * 管理者ユーザー管理画面で使用するプロフィール設定
 *
 * admin カテゴリのロールを動的に取得
 */

import { getProfilesByCategory } from "@/features/core/userProfile/utils/profileSchemaHelpers";

export const MANAGERIAL_USER_PROFILES = getProfilesByCategory("admin");
