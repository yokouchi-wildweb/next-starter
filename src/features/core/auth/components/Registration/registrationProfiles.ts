// src/features/core/auth/components/Registration/registrationProfiles.ts
/**
 * 本登録画面のプロフィールバリデーション用設定
 *
 * allowedRoles のうち、プロフィール設定を持つロールのみ対象
 */

import { APP_FEATURES } from "@/config/app/app-features.config";
import { PROFILE_CONFIG_REGISTRY } from "@/registry/profileConfigRegistry";
import type { ProfileConfig } from "@/features/core/userProfile/profiles";

const allowedRoles = APP_FEATURES.auth.signup.allowedRoles;

export const REGISTRATION_PROFILES: Record<string, ProfileConfig> = Object.fromEntries(
  allowedRoles
    .filter((roleId) => PROFILE_CONFIG_REGISTRY[roleId])
    .map((roleId) => [roleId, PROFILE_CONFIG_REGISTRY[roleId]])
);
