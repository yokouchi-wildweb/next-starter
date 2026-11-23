// src/domains/core/user/constants/index.ts

export {
  USER_PROVIDER_TYPES,
  OAUTH_PROVIDER_IDS,
} from "./provider";

// ロール設定
export { roles as ALL_ROLES } from "@/domains/core/user/extensions/roles";

// ロール派生定数
export {
  USER_ROLES,
  type UserRoleType,
} from "./role";

// ロールヘルパー関数
export {
  getRoleConfig,
  isRoleEnabled,
  assertRoleEnabled,
  formatUserRoleLabel,
  getRolesByCategory,
  getRoleOptionsByCategory,
  getAllRoleOptions,
  getRolesWithProfile,
  getRoleCategory,
  getRoleDescription,
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
  BULK_STATUS_TARGETS,
} from "./status";

// 型定義（types からの再エクスポート）
export type { RoleCategory, RoleConfig } from "../types";
export type { ProfileFieldConfig } from "@/domains/core/userProfile/types";
