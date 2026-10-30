// src/features/core/auth/components/Registration/registrationProfiles.ts
/**
 * 本登録画面のプロフィールバリデーション用設定
 *
 * allowedRoles のうち、プロフィール設定を持つロールのみ対象
 */

import { APP_FEATURES } from "@/config/app/app-features.config";
import { profileConfigs } from "@/features/core/userProfile/extensions/profileConfigs";
import type { ProfileConfig } from "@/features/core/userProfile/profiles";

const allowedRoles = APP_FEATURES.auth.signup.allowedRoles;

export const REGISTRATION_PROFILES: Record<string, ProfileConfig> = Object.fromEntries(
  allowedRoles
    .filter((roleId) => profileConfigs[roleId])
    .map((roleId) => [roleId, profileConfigs[roleId]])
);
