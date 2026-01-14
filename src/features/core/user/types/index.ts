// src/features/core/user/types/index.ts

import {
  USER_PROVIDER_TYPES,
  USER_ROLES,
  USER_STATUSES,
} from "@/features/core/user/constants";

// 既存の型（constants からの派生型）
export type UserProviderType = (typeof USER_PROVIDER_TYPES)[number];
export type UserRoleType = (typeof USER_ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];

// プロフィールフィールド関連の型（userProfile からの再エクスポート）
export {
  CORE_PROFILE_FIELD_TAGS,
  type CoreProfileFieldTag,
  type ProfileFieldConfig,
  type ProfileFieldTag,
} from "@/features/core/userProfile";

// ロール関連の型
export { type RoleCategory, type RoleConfig } from "./role";
