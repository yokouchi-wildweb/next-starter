// src/features/core/user/constants/index.ts

export {
  USER_PROVIDER_TYPES,
  OAUTH_PROVIDER_IDS,
} from "./provider";

export {
  USER_ROLES,
  USER_ROLE_OPTIONS,
  USER_ROLE_LABELS,
  USER_ROLE_CATEGORIES,
  USER_ROLE_DESCRIPTIONS,
  USER_ROLE_HAS_PROFILE,
  ALL_ROLES,
  formatUserRoleLabel,
  getRolesByCategory,
  getRoleOptionsByCategory,
  getRolesWithProfile,
  getRoleCategory,
  hasRoleProfile,
  getProfileFields,
  getFieldsByTags,
  getRegistrationFields,
  getMyPageFields,
  getAdminFields,
} from "./role";

export type {
  RoleCategory,
  RoleConfig,
  AdditionalRoleConfig,
  ProfileFieldConfig,
  ProfileFieldTag,
  CoreProfileFieldTag,
  UserRoleType,
  // domain.json 共通型（DomainFieldRenderer から）
  DomainFormInput,
  DomainFieldType,
  DomainJsonField,
} from "./role";

export {
  USER_STATUSES,
  USER_STATUS_LABELS,
  USER_STATUS_OPTIONS,
  formatUserStatusLabel,
  USER_AVAILABLE_STATUSES,
  USER_REGISTERED_STATUSES,
} from "./status";
