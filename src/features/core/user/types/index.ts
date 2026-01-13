// src/features/core/user/types/index.ts

import {
  USER_PROVIDER_TYPES,
  USER_ROLE_OPTIONS,
  USER_ROLES,
  USER_STATUSES,
} from "@/features/core/user/constants";

// 既存の型（constants からの派生型）
export type UserProviderType = (typeof USER_PROVIDER_TYPES)[number];
export type UserRoleType = (typeof USER_ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];
export type UserRoleOption = (typeof USER_ROLE_OPTIONS)[number];

// プロフィールフィールド関連の型
export {
  CORE_PROFILE_FIELD_TAGS,
  type CoreProfileFieldTag,
  type ProfileFieldConfig,
} from "./profileField";

// ロール関連の型
export {
  type RoleCategory,
  type RoleConfig,
  type AdditionalRoleConfig,
  type CoreRoleId,
  type CoreRoleExtension,
} from "./role";
