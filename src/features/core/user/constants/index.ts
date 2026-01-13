// src/features/core/user/constants/index.ts

export {
  USER_PROVIDER_TYPES,
  OAUTH_PROVIDER_IDS,
} from "./provider";

// ロール設定
export { ALL_ROLES } from "@/registry/roleRegistry";
export { CORE_ROLE_IDS, type CoreRoleId } from "./role";
export { isCoreRole } from "../utils/roleHelpers";

// ロール派生定数
export {
  USER_ROLES,
  USER_ROLE_OPTIONS,
  USER_ROLE_LABELS,
  USER_ROLE_CATEGORIES,
  USER_ROLE_DESCRIPTIONS,
  USER_ROLE_HAS_PROFILE,
  type UserRoleType,
} from "./role";

// ロールヘルパー関数
export {
  formatUserRoleLabel,
  getRolesByCategory,
  getRoleOptionsByCategory,
  getRolesWithProfile,
  getRoleCategory,
  hasRoleProfile,
} from "../utils/roleHelpers";

// ステータス
export {
  USER_STATUSES,
  USER_STATUS_LABELS,
  USER_STATUS_OPTIONS,
  formatUserStatusLabel,
  USER_AVAILABLE_STATUSES,
  USER_REGISTERED_STATUSES,
} from "./status";

// 型定義（types からの再エクスポート）
export type { RoleCategory, RoleConfig } from "../types";
export type { ProfileFieldConfig } from "@/features/core/userProfile/types";
