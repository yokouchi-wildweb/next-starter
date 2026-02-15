// src/features/core/user/constants/index.ts

export {
  USER_PROVIDER_TYPES,
  OAUTH_PROVIDER_IDS,
} from "./provider";

// ロール設定
export { ALL_ROLES } from "@/registry/roleRegistry";

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
} from "./status";

// 電話番号認証
export {
  PHONE_VERIFICATION_OTP_LENGTH,
  PHONE_VERIFICATION_OTP_EXPIRY_SECONDS,
} from "./phoneVerification";

// 型定義（types からの再エクスポート）
export type { RoleCategory, RoleConfig } from "../types";
export type { ProfileFieldConfig } from "@/features/core/userProfile/types";
