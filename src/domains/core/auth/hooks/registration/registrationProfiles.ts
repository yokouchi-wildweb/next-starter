// src/domains/core/auth/hooks/registration/registrationProfiles.ts
/**
 * 本登録画面のプロフィールバリデーション用設定
 *
 * allowedRoles のうち、プロフィール設定を持つロールのみ対象
 */

import { authConfig } from "@/domains/auth/config";
import { profileConfigs } from "@/domains/core/userProfile/extensions/profileConfigs";
import type { ProfileConfig } from "@/domains/core/userProfile/profiles";

const allowedRoles = authConfig.signup.allowedRoles;

export const REGISTRATION_PROFILES: Record<string, ProfileConfig> = Object.fromEntries(
  allowedRoles
    .filter((roleId) => profileConfigs[roleId])
    .map((roleId) => [roleId, profileConfigs[roleId]])
);
